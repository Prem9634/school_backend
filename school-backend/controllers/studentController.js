const bcrypt = require("bcryptjs");
const pool = require("../config/db");
const { asyncHandler } = require("../middleware/errorHandler");

exports.getStudents = asyncHandler(async (req, res) => {
  const schoolId = req.user.role === "admin" ? req.query.school_id : req.user.school_id;
  const { class_id, search, status = "Active", academic_year = "2024-25", page = 1, limit = 50 } = req.query;

  const offset = (parseInt(page) - 1) * parseInt(limit);
  const params = [];
  let where = "WHERE 1=1";

  if (schoolId) { where += " AND s.school_id = ?"; params.push(schoolId); }
  if (class_id)  { where += " AND s.class_id = ?";  params.push(class_id); }
  if (status)    { where += " AND s.status = ?";     params.push(status); }
  if (academic_year) { where += " AND s.academic_year = ?"; params.push(academic_year); }
  if (search) {
    where += " AND (s.name LIKE ? OR s.student_id LIKE ? OR s.father_name LIKE ? OR s.mobile LIKE ?)";
    const q = `%${search}%`;
    params.push(q, q, q, q);
  }

  const [rows] = await pool.execute(
    `SELECT s.*, c.name AS class_name, c.section,
            COALESCE(SUM(fp.amount), 0) AS total_paid,
            fs_total.total_fee,
            ROUND(
              (SELECT COUNT(*) FROM attendance a WHERE a.student_id = s.id AND a.status = 'Present')
              / NULLIF((SELECT COUNT(*) FROM attendance a2 WHERE a2.student_id = s.id AND a2.status != 'Holiday'), 0) * 100
            , 1) AS attendance_pct
     FROM students s
     JOIN classes c ON s.class_id = c.id
     LEFT JOIN fee_payments fp ON fp.student_id = s.id AND fp.academic_year = ?
     LEFT JOIN (
       SELECT class_id, SUM(amount) AS total_fee
       FROM fee_structures WHERE academic_year = ?
       GROUP BY class_id
     ) fs_total ON fs_total.class_id = s.class_id
     ${where}
     GROUP BY s.id
     ORDER BY s.name ASC
     LIMIT ? OFFSET ?`,
    [academic_year, academic_year, ...params, parseInt(limit), offset]
  );

  const [[{ total }]] = await pool.execute(
    `SELECT COUNT(*) AS total FROM students s ${where}`,
    params
  );

  res.json({ success: true, data: rows, pagination: { total, page: +page, limit: +limit, pages: Math.ceil(total / limit) } });
});

exports.getStudent = asyncHandler(async (req, res) => {
  const schoolId = req.user.role === "admin" ? null : req.user.school_id;
  const params = [req.params.id];
  let schoolCheck = "";
  if (schoolId) { schoolCheck = "AND s.school_id = ?"; params.push(schoolId); }

  const [rows] = await pool.execute(
    `SELECT s.*, c.name AS class_name, c.section, c.room,
            u.email AS login_email
     FROM students s
     JOIN classes c ON s.class_id = c.id
     LEFT JOIN users u ON u.id = s.user_id
     WHERE s.id = ? ${schoolCheck}`,
    params
  );

  if (!rows.length) return res.status(404).json({ success: false, message: "Student not found" });

  const [marks] = await pool.execute(
    `SELECT m.*, sub.name AS subject_name
     FROM marks m
     JOIN subjects sub ON sub.id = m.subject_id
     WHERE m.student_id = ? AND m.academic_year = '2024-25'
     ORDER BY sub.name`,
    [req.params.id]
  );

  const [feeSummary] = await pool.execute(
    `SELECT fee_type, SUM(amount) AS amount FROM fee_payments
     WHERE student_id = ? AND academic_year = '2024-25'
     GROUP BY fee_type`,
    [req.params.id]
  );

  res.json({ success: true, data: { ...rows[0], marks, feeSummary } });
});

exports.createStudent = asyncHandler(async (req, res) => {
  const schoolId = req.user.school_id;
  const {
    class_id, name, gender, dob, father_name, mother_name,
    mobile, alt_mobile, address, academic_year = "2024-25",
    create_login = false, password
  } = req.body;

  if (!class_id || !name || !gender || !dob || !father_name || !mobile) {
    return res.status(400).json({ success: false, message: "Required fields: class_id, name, gender, dob, father_name, mobile" });
  }

  const [[{ cnt }]] = await pool.execute("SELECT COUNT(*) AS cnt FROM students WHERE school_id = ?", [schoolId]);
  const student_id = `STU${String(cnt + 1).padStart(3, "0")}`;

  const [[{ maxRoll }]] = await pool.execute(
    "SELECT COALESCE(MAX(CAST(roll_no AS UNSIGNED)), 0) AS maxRoll FROM students WHERE class_id = ? AND academic_year = ?",
    [class_id, academic_year]
  );
  const roll_no = String(maxRoll + 1).padStart(2, "0");

  const conn = await pool.getConnection();
  await conn.beginTransaction();

  try {
    let userId = null;

    if (create_login) {
      const email = `${student_id.toLowerCase()}@school.com`;
      const hash = await bcrypt.hash(password || "student123", 12);
      const [userResult] = await conn.execute(
        "INSERT INTO users (school_id, name, email, password_hash, role) VALUES (?, ?, ?, ?, 'student')",
        [schoolId, name, email, hash]
      );
      userId = userResult.insertId;
    }

    const [result] = await conn.execute(
      `INSERT INTO students
        (school_id, user_id, student_id, class_id, roll_no, name, gender, dob,
         father_name, mother_name, mobile, alt_mobile, address, academic_year)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [schoolId, userId, student_id, class_id, roll_no, name, gender, dob,
       father_name, mother_name || null, mobile, alt_mobile || null, address || null, academic_year]
    );

    await conn.commit();
    res.status(201).json({ success: true, message: "Student registered successfully", data: { id: result.insertId, student_id } });
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
});

exports.updateStudent = asyncHandler(async (req, res) => {
  const schoolId = req.user.role === "admin" ? null : req.user.school_id;
  const { name, father_name, mother_name, mobile, alt_mobile, address, class_id, status, gender, dob } = req.body;

  const params = [name, father_name, mother_name, mobile, alt_mobile, address, class_id, status, gender, dob, req.params.id];
  let schoolCheck = "";
  if (schoolId) { schoolCheck = "AND school_id = ?"; params.push(schoolId); }

  const [result] = await pool.execute(
    `UPDATE students SET name=?, father_name=?, mother_name=?, mobile=?, alt_mobile=?,
     address=?, class_id=?, status=?, gender=?, dob=?, updated_at=NOW()
     WHERE id=? ${schoolCheck}`,
    params
  );

  if (!result.affectedRows) return res.status(404).json({ success: false, message: "Student not found" });
  res.json({ success: true, message: "Student updated successfully" });
});

exports.deleteStudent = asyncHandler(async (req, res) => {
  const [result] = await pool.execute(
    "UPDATE students SET status = 'Inactive' WHERE id = ? AND school_id = ?",
    [req.params.id, req.user.school_id]
  );
  if (!result.affectedRows) return res.status(404).json({ success: false, message: "Student not found" });
  res.json({ success: true, message: "Student deactivated" });
});

exports.getIdCard = asyncHandler(async (req, res) => {
  const studentId = req.user.role === "student"
    ? (await pool.execute("SELECT id FROM students WHERE user_id = ?", [req.user.id]))[0][0]?.id
    : req.params.id;

  const [rows] = await pool.execute(
    `SELECT s.*, c.name AS class_name, c.section, sch.name AS school_name, sch.phone AS school_phone
     FROM students s
     JOIN classes c ON c.id = s.class_id
     JOIN schools sch ON sch.id = s.school_id
     WHERE s.id = ?`,
    [studentId]
  );

  if (!rows.length) return res.status(404).json({ success: false, message: "Student not found" });
  res.json({ success: true, data: rows[0] });
});
