const pool = require("../config/db");
const { asyncHandler } = require("../middleware/errorHandler");

exports.getHomework = asyncHandler(async (req, res) => {
  const schoolId = req.user.school_id;
  const { class_id, status = "Active" } = req.query;

  let classId = class_id;
  if (req.user.role === "student" && !classId) {
    const [[stu]] = await pool.execute("SELECT class_id FROM students WHERE user_id = ?", [req.user.id]);
    if (stu) classId = stu.class_id;
  }

  let where = "WHERE hw.school_id = ?";
  const params = [schoolId];
  if (classId) { where += " AND hw.class_id = ?"; params.push(classId); }
  if (status)  { where += " AND hw.status = ?";   params.push(status); }

  const [rows] = await pool.execute(
    `SELECT hw.*, c.name AS class_name, c.section,
            sub.name AS subject_name, u.name AS assigned_by_name
     FROM homework hw
     JOIN classes c ON c.id = hw.class_id
     LEFT JOIN subjects sub ON sub.id = hw.subject_id
     JOIN users u ON u.id = hw.assigned_by
     ${where}
     ORDER BY hw.due_date DESC`,
    params
  );

  res.json({ success: true, data: rows });
});

exports.createHomework = asyncHandler(async (req, res) => {
  const schoolId = req.user.school_id;
  const { class_id, subject_id, title, description, due_date } = req.body;

  if (!class_id || !title || !due_date) {
    return res.status(400).json({ success: false, message: "class_id, title, due_date are required" });
  }

  const [result] = await pool.execute(
    `INSERT INTO homework (school_id, class_id, subject_id, title, description, due_date, assigned_by)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [schoolId, class_id, subject_id || null, title, description || null, due_date, req.user.id]
  );

  res.status(201).json({ success: true, message: "Homework assigned", data: { id: result.insertId } });
});

exports.updateHomework = asyncHandler(async (req, res) => {
  const { title, description, due_date, status } = req.body;
  const [result] = await pool.execute(
    `UPDATE homework SET title = ?, description = ?, due_date = ?, status = ?, updated_at = NOW()
     WHERE id = ? AND school_id = ? AND assigned_by = ?`,
    [title, description, due_date, status || "Active", req.params.id, req.user.school_id, req.user.id]
  );
  if (!result.affectedRows) return res.status(404).json({ success: false, message: "Homework not found or unauthorized" });
  res.json({ success: true, message: "Homework updated" });
});

exports.deleteHomework = asyncHandler(async (req, res) => {
  const [result] = await pool.execute(
    "DELETE FROM homework WHERE id = ? AND school_id = ? AND assigned_by = ?",
    [req.params.id, req.user.school_id, req.user.id]
  );
  if (!result.affectedRows) return res.status(404).json({ success: false, message: "Homework not found or unauthorized" });
  res.json({ success: true, message: "Homework deleted" });
});
