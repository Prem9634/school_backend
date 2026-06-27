const pool = require("../config/db");
const { asyncHandler } = require("../middleware/errorHandler");

exports.sendSms = asyncHandler(async (req, res) => {
  const schoolId = req.user.school_id;
  const { class_id, recipient_type = "class", message, individual_student_id } = req.body;

  if (!message || message.trim().length === 0) {
    return res.status(400).json({ success: false, message: "Message is required" });
  }

  let recipients = [];
  if (recipient_type === "class" && class_id) {
    const [rows] = await pool.execute(
      "SELECT mobile, name FROM students WHERE class_id = ? AND school_id = ? AND status = 'Active'",
      [class_id, schoolId]
    );
    recipients = rows;
  } else if (recipient_type === "individual" && individual_student_id) {
    const [rows] = await pool.execute(
      "SELECT mobile, name FROM students WHERE id = ? AND school_id = ?",
      [individual_student_id, schoolId]
    );
    recipients = rows;
  } else if (recipient_type === "pending_fee") {
    const [rows] = await pool.execute(
      `SELECT s.mobile, s.name FROM students s
       JOIN classes c ON c.id = s.class_id
       LEFT JOIN fee_structures fs ON fs.class_id = s.class_id AND fs.academic_year = '2024-25'
       LEFT JOIN (
         SELECT student_id, SUM(amount) AS paid FROM fee_payments WHERE academic_year = '2024-25' GROUP BY student_id
       ) fp ON fp.student_id = s.id
       WHERE s.school_id = ? AND s.status = 'Active'
       HAVING (COALESCE(fs.amount, 0) - COALESCE(fp.paid, 0)) > 0`,
      [schoolId]
    );
    recipients = rows;
  }

  // In production: integrate SMS gateway here (e.g., Twilio, MSG91)
  await pool.execute(
    `INSERT INTO sms_logs (school_id, sent_by, recipient_type, class_id, message, recipient_count, status)
     VALUES (?, ?, ?, ?, ?, ?, 'Sent')`,
    [schoolId, req.user.id, recipient_type, class_id || null, message, recipients.length]
  );

  res.json({
    success: true,
    message: `SMS sent to ${recipients.length} recipients`,
    data: { recipient_count: recipients.length },
  });
});

exports.getSmsLogs = asyncHandler(async (req, res) => {
  const schoolId = req.user.school_id;

  const [rows] = await pool.execute(
    `SELECT sl.*, u.name AS sent_by_name, c.name AS class_name, c.section
     FROM sms_logs sl
     LEFT JOIN users u ON u.id = sl.sent_by
     LEFT JOIN classes c ON c.id = sl.class_id
     WHERE sl.school_id = ?
     ORDER BY sl.created_at DESC
     LIMIT 50`,
    [schoolId]
  );

  res.json({ success: true, data: rows });
});
