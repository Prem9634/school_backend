const pool = require("../config/db");
const { asyncHandler } = require("../middleware/errorHandler");

exports.getMarks = asyncHandler(async (req, res) => {
  const schoolId = req.user.school_id;
  const { class_id, student_id, exam_type = "Annual", academic_year = "2024-25" } = req.query;

  let where = "WHERE m.school_id = ? AND m.exam_type = ? AND m.academic_year = ?";
  const params = [schoolId, exam_type, academic_year];

  if (class_id)   { where += " AND m.class_id = ?";   params.push(class_id); }
  if (student_id) { where += " AND m.student_id = ?"; params.push(student_id); }

  const [rows] = await pool.execute(
    `SELECT m.*, s.name AS student_name, s.roll_no, s.student_id AS student_code,
            sub.name AS subject_name, c.name AS class_name, c.section
     FROM marks m
     JOIN students s ON s.id = m.student_id
     JOIN subjects sub ON sub.id = m.subject_id
     JOIN classes c ON c.id = m.class_id
     ${where}
     ORDER BY s.roll_no, sub.name`,
    params
  );

  res.json({ success: true, data: rows });
});

exports.bulkEnterMarks = asyncHandler(async (req, res) => {
  const schoolId = req.user.school_id;
  const { class_id, subject_id, exam_type = "Annual", academic_year = "2024-25", entries } = req.body;

  if (!class_id || !subject_id || !Array.isArray(entries) || !entries.length) {
    return res.status(400).json({ success: false, message: "class_id, subject_id, entries[] required" });
  }

  const [[subject]] = await pool.execute("SELECT max_marks FROM subjects WHERE id = ? AND school_id = ?", [subject_id, schoolId]);
  if (!subject) return res.status(404).json({ success: false, message: "Subject not found" });

  const conn = await pool.getConnection();
  await conn.beginTransaction();

  try {
    for (const entry of entries) {
      const grade = calcGrade(entry.marks_obtained, subject.max_marks);
      await conn.execute(
        `INSERT INTO marks (school_id, student_id, subject_id, class_id, exam_type, academic_year,
                            marks_obtained, max_marks, grade, remarks, entered_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           marks_obtained = VALUES(marks_obtained), grade = VALUES(grade),
           remarks = VALUES(remarks), entered_by = VALUES(entered_by), updated_at = NOW()`,
        [schoolId, entry.student_id, subject_id, class_id, exam_type, academic_year,
         entry.marks_obtained, subject.max_marks, grade, entry.remarks || null, req.user.id]
      );
    }
    await conn.commit();
    res.json({ success: true, message: `Marks entered for ${entries.length} students` });
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
});

exports.getStudentResult = asyncHandler(async (req, res) => {
  let studentId = req.params.studentId;
  const { exam_type = "Annual", academic_year = "2024-25" } = req.query;

  if (req.user.role === "student") {
    const [[stu]] = await pool.execute("SELECT id FROM students WHERE user_id = ?", [req.user.id]);
    if (!stu) return res.status(404).json({ success: false, message: "Student record not found" });
    studentId = stu.id;
  }

  const [rows] = await pool.execute(
    `SELECT m.marks_obtained, m.max_marks, m.grade, m.exam_type, m.remarks,
            sub.name AS subject_name, sub.code AS subject_code
     FROM marks m
     JOIN subjects sub ON sub.id = m.subject_id
     WHERE m.student_id = ? AND m.exam_type = ? AND m.academic_year = ?
     ORDER BY sub.name`,
    [studentId, exam_type, academic_year]
  );

  if (!rows.length) return res.json({ success: true, data: [], summary: null });

  const totalObtained = rows.reduce((a, r) => a + parseFloat(r.marks_obtained), 0);
  const totalMax = rows.reduce((a, r) => a + r.max_marks, 0);
  const percentage = Math.round((totalObtained / totalMax) * 100 * 10) / 10;

  res.json({
    success: true,
    data: rows,
    summary: {
      total_subjects: rows.length,
      total_obtained: totalObtained,
      total_max: totalMax,
      percentage,
      overall_grade: calcGrade(totalObtained, totalMax),
    },
  });
});

exports.getClassAnalytics = asyncHandler(async (req, res) => {
  const schoolId = req.user.school_id;
  const { class_id, exam_type = "Annual", academic_year = "2024-25" } = req.query;

  const [toppers] = await pool.execute(
    `SELECT s.id, s.name, s.roll_no,
            SUM(m.marks_obtained) AS total_obtained,
            SUM(m.max_marks) AS total_max,
            ROUND(SUM(m.marks_obtained)/SUM(m.max_marks)*100, 1) AS percentage
     FROM marks m
     JOIN students s ON s.id = m.student_id
     WHERE m.school_id = ? AND m.class_id = ? AND m.exam_type = ? AND m.academic_year = ?
     GROUP BY s.id, s.name, s.roll_no
     ORDER BY percentage DESC
     LIMIT 10`,
    [schoolId, class_id, exam_type, academic_year]
  );

  const [subjectAvg] = await pool.execute(
    `SELECT sub.name AS subject, ROUND(AVG(m.marks_obtained), 1) AS average,
            MAX(m.marks_obtained) AS highest, MIN(m.marks_obtained) AS lowest
     FROM marks m
     JOIN subjects sub ON sub.id = m.subject_id
     WHERE m.school_id = ? AND m.class_id = ? AND m.exam_type = ? AND m.academic_year = ?
     GROUP BY sub.id, sub.name
     ORDER BY sub.name`,
    [schoolId, class_id, exam_type, academic_year]
  );

  res.json({ success: true, data: { toppers, subjectAvg } });
});

function calcGrade(obtained, max) {
  const pct = (obtained / max) * 100;
  if (pct >= 90) return "A+";
  if (pct >= 80) return "A";
  if (pct >= 70) return "B+";
  if (pct >= 60) return "B";
  if (pct >= 50) return "C";
  if (pct >= 33) return "D";
  return "F";
}
