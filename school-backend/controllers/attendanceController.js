const pool = require("../config/db");
const { asyncHandler } = require("../middleware/errorHandler");

exports.getAttendance = asyncHandler(async (req, res) => {
  const schoolId = req.user.school_id;
  const { class_id, date, from_date, to_date, student_id } = req.query;

  let where = "WHERE a.school_id = ?";
  const params = [schoolId];

  if (class_id)   { where += " AND a.class_id = ?";    params.push(class_id); }
  if (date)       { where += " AND a.date = ?";         params.push(date); }
  if (from_date)  { where += " AND a.date >= ?";        params.push(from_date); }
  if (to_date)    { where += " AND a.date <= ?";        params.push(to_date); }
  if (student_id) { where += " AND a.student_id = ?";   params.push(student_id); }

  const [rows] = await pool.execute(
    `SELECT a.*, s.name AS student_name, s.roll_no, s.photo_url,
            c.name AS class_name, c.section,
            u.name AS marked_by_name
     FROM attendance a
     JOIN students s ON s.id = a.student_id
     JOIN classes c ON c.id = a.class_id
     LEFT JOIN users u ON u.id = a.marked_by
     ${where}
     ORDER BY s.roll_no`,
    params
  );

  res.json({ success: true, data: rows });
});

exports.markAttendance = asyncHandler(async (req, res) => {
  const schoolId = req.user.school_id;
  const { class_id, date, records } = req.body;

  if (!class_id || !date || !Array.isArray(records) || !records.length) {
    return res.status(400).json({ success: false, message: "class_id, date, and records[] required" });
  }

  const [[cls]] = await pool.execute(
    "SELECT id FROM classes WHERE id = ? AND school_id = ?", [class_id, schoolId]
  );
  if (!cls) return res.status(404).json({ success: false, message: "Class not found" });

  const conn = await pool.getConnection();
  await conn.beginTransaction();

  try {
    for (const rec of records) {
      await conn.execute(
        `INSERT INTO attendance (school_id, student_id, class_id, date, status, marked_by, remarks)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE status = VALUES(status), marked_by = VALUES(marked_by),
         remarks = VALUES(remarks), updated_at = NOW()`,
        [schoolId, rec.student_id, class_id, date, rec.status || "Present", req.user.id, rec.remarks || null]
      );
    }
    await conn.commit();
    res.json({ success: true, message: `Attendance marked for ${records.length} students` });
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
});

exports.updateAttendance = asyncHandler(async (req, res) => {
  const { status, remarks } = req.body;
  const [result] = await pool.execute(
    "UPDATE attendance SET status = ?, remarks = ?, updated_at = NOW() WHERE id = ? AND school_id = ?",
    [status, remarks || null, req.params.id, req.user.school_id]
  );
  if (!result.affectedRows) return res.status(404).json({ success: false, message: "Record not found" });
  res.json({ success: true, message: "Attendance updated" });
});

exports.getAttendanceSummary = asyncHandler(async (req, res) => {
  const schoolId = req.user.school_id;
  const { class_id, academic_year, from_date, to_date } = req.query;

  let dateFilter = "";
  const params = [schoolId];
  if (from_date) { dateFilter += " AND a.date >= ?"; params.push(from_date); }
  if (to_date)   { dateFilter += " AND a.date <= ?"; params.push(to_date); }

  let classFilter = "";
  if (class_id) { classFilter = "AND s.class_id = ?"; params.push(class_id); }

  const [rows] = await pool.execute(
    `SELECT s.id, s.name, s.roll_no, s.student_id,
            c.name AS class_name, c.section,
            COUNT(a.id) AS total_days,
            SUM(a.status = 'Present') AS present,
            SUM(a.status = 'Absent') AS absent,
            SUM(a.status = 'Late') AS late,
            ROUND(SUM(a.status = 'Present') / NULLIF(COUNT(CASE WHEN a.status != 'Holiday' THEN 1 END), 0) * 100, 1) AS attendance_pct
     FROM students s
     JOIN classes c ON c.id = s.class_id
     LEFT JOIN attendance a ON a.student_id = s.id ${dateFilter}
     WHERE s.school_id = ? ${classFilter}
     GROUP BY s.id, s.name, s.roll_no, s.student_id, c.name, c.section
     ORDER BY attendance_pct DESC`,
    params
  );

  res.json({ success: true, data: rows });
});

exports.getClassReport = asyncHandler(async (req, res) => {
  const schoolId = req.user.school_id;
  const { date = new Date().toISOString().split("T")[0] } = req.query;

  const [rows] = await pool.execute(
    `SELECT c.id, c.name AS class_name, c.section,
            COUNT(DISTINCT s.id) AS total_students,
            SUM(a.status = 'Present') AS present,
            SUM(a.status = 'Absent') AS absent,
            ROUND(SUM(a.status = 'Present') / NULLIF(COUNT(s.id), 0) * 100, 1) AS attendance_pct
     FROM classes c
     JOIN students s ON s.class_id = c.id AND s.status = 'Active'
     LEFT JOIN attendance a ON a.student_id = s.id AND a.date = ?
     WHERE c.school_id = ?
     GROUP BY c.id, c.name, c.section
     ORDER BY c.name, c.section`,
    [date, schoolId]
  );

  res.json({ success: true, data: rows });
});

exports.getStudentAttendance = asyncHandler(async (req, res) => {
  const { from_date, to_date } = req.query;
  let studentId = req.params.studentId;

  if (req.user.role === "student") {
    const [[stu]] = await pool.execute("SELECT id FROM students WHERE user_id = ?", [req.user.id]);
    if (!stu) return res.status(404).json({ success: false, message: "Student record not found" });
    studentId = stu.id;
  }

  let where = "WHERE a.student_id = ?";
  const params = [studentId];
  if (from_date) { where += " AND a.date >= ?"; params.push(from_date); }
  if (to_date)   { where += " AND a.date <= ?"; params.push(to_date); }

  const [rows] = await pool.execute(
    `SELECT a.date, a.status, a.remarks FROM attendance a ${where} ORDER BY a.date DESC`,
    params
  );

  const stats = {
    total: rows.length,
    present: rows.filter(r => r.status === "Present").length,
    absent: rows.filter(r => r.status === "Absent").length,
    late: rows.filter(r => r.status === "Late").length,
  };
  stats.percentage = rows.length ? Math.round(stats.present / rows.length * 100) : 0;

  res.json({ success: true, data: rows, stats });
});
