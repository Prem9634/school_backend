const pool = require("../config/db");
const { asyncHandler } = require("../middleware/errorHandler");

exports.getClasses = asyncHandler(async (req, res) => {
  const schoolId = req.user.role === "admin" ? (req.query.school_id || null) : req.user.school_id;
  const { academic_year = "2024-25" } = req.query;

  let where = "WHERE c.academic_year = ?";
  const params = [academic_year];
  if (schoolId) { where += " AND c.school_id = ?"; params.push(schoolId); }

  const [rows] = await pool.execute(
    `SELECT c.*, u.name AS teacher_name,
            COUNT(s.id) AS student_count
     FROM classes c
     LEFT JOIN users u ON u.id = c.class_teacher_id
     LEFT JOIN students s ON s.class_id = c.id AND s.status = 'Active'
     ${where}
     GROUP BY c.id
     ORDER BY c.name, c.section`,
    params
  );

  res.json({ success: true, data: rows });
});

exports.getClass = asyncHandler(async (req, res) => {
  const [rows] = await pool.execute(
    `SELECT c.*, u.name AS teacher_name
     FROM classes c LEFT JOIN users u ON u.id = c.class_teacher_id
     WHERE c.id = ?`,
    [req.params.id]
  );
  if (!rows.length) return res.status(404).json({ success: false, message: "Class not found" });
  res.json({ success: true, data: rows[0] });
});

exports.createClass = asyncHandler(async (req, res) => {
  const schoolId = req.user.school_id;
  const { name, section, room, class_teacher_id, academic_year = "2024-25" } = req.body;

  if (!name || !section) {
    return res.status(400).json({ success: false, message: "name and section are required" });
  }

  const [result] = await pool.execute(
    "INSERT INTO classes (school_id, name, section, room, class_teacher_id, academic_year) VALUES (?, ?, ?, ?, ?, ?)",
    [schoolId, name, section, room || null, class_teacher_id || null, academic_year]
  );

  res.status(201).json({ success: true, message: "Class created", data: { id: result.insertId } });
});

exports.updateClass = asyncHandler(async (req, res) => {
  const { name, section, room, class_teacher_id } = req.body;
  const [result] = await pool.execute(
    "UPDATE classes SET name = ?, section = ?, room = ?, class_teacher_id = ? WHERE id = ? AND school_id = ?",
    [name, section, room || null, class_teacher_id || null, req.params.id, req.user.school_id]
  );
  if (!result.affectedRows) return res.status(404).json({ success: false, message: "Class not found" });
  res.json({ success: true, message: "Class updated" });
});

exports.deleteClass = asyncHandler(async (req, res) => {
  const [[{ cnt }]] = await pool.execute(
    "SELECT COUNT(*) AS cnt FROM students WHERE class_id = ? AND status = 'Active'", [req.params.id]
  );
  if (cnt > 0) {
    return res.status(400).json({ success: false, message: `Cannot delete: ${cnt} active students in this class` });
  }
  await pool.execute("DELETE FROM classes WHERE id = ? AND school_id = ?", [req.params.id, req.user.school_id]);
  res.json({ success: true, message: "Class deleted" });
});

exports.getClassSubjects = asyncHandler(async (req, res) => {
  const [rows] = await pool.execute(
    `SELECT sub.*, u.name AS teacher_name
     FROM subjects sub LEFT JOIN users u ON u.id = sub.teacher_id
     WHERE sub.class_id = ?
     ORDER BY sub.name`,
    [req.params.id]
  );
  res.json({ success: true, data: rows });
});

exports.addSubject = asyncHandler(async (req, res) => {
  const { name, code, teacher_id, max_marks = 100 } = req.body;
  if (!name) return res.status(400).json({ success: false, message: "Subject name required" });

  const [cls] = await pool.execute("SELECT school_id FROM classes WHERE id = ?", [req.params.id]);
  if (!cls.length) return res.status(404).json({ success: false, message: "Class not found" });

  const [result] = await pool.execute(
    "INSERT INTO subjects (school_id, class_id, name, code, teacher_id, max_marks) VALUES (?, ?, ?, ?, ?, ?)",
    [cls[0].school_id, req.params.id, name, code || null, teacher_id || null, max_marks]
  );
  res.status(201).json({ success: true, message: "Subject added", data: { id: result.insertId } });
});
