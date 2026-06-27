const pool = require("../config/db");
const { asyncHandler } = require("../middleware/errorHandler");

exports.getFeeSummary = asyncHandler(async (req, res) => {
  const schoolId = req.user.school_id || req.query.school_id;
  const academic_year = req.query.academic_year || "2024-25";

  const [[summary]] = await pool.execute(
    `SELECT
       COUNT(DISTINCT s.id)                         AS total_students,
       COALESCE(SUM(fs.amount), 0)                  AS total_fee_structure,
       COALESCE(SUM(fp.paid), 0)                    AS total_collected,
       COUNT(DISTINCT CASE WHEN fp.paid >= fs.class_total THEN s.id END) AS fully_paid,
       COUNT(DISTINCT CASE WHEN fp.paid < fs.class_total OR fp.paid IS NULL THEN s.id END) AS pending_count
     FROM students s
     LEFT JOIN (
       SELECT class_id, SUM(amount) AS amount, SUM(amount) AS class_total
       FROM fee_structures WHERE academic_year = ? GROUP BY class_id
     ) fs ON fs.class_id = s.class_id
     LEFT JOIN (
       SELECT student_id, SUM(amount) AS paid
       FROM fee_payments WHERE academic_year = ? GROUP BY student_id
     ) fp ON fp.student_id = s.id
     WHERE s.school_id = ? AND s.status = 'Active'`,
    [academic_year, academic_year, schoolId]
  );

  const [monthly] = await pool.execute(
    `SELECT MONTH(payment_date) AS month, MONTHNAME(payment_date) AS month_name,
            SUM(amount) AS total
     FROM fee_payments
     WHERE school_id = ? AND YEAR(payment_date) = YEAR(CURDATE())
     GROUP BY MONTH(payment_date), MONTHNAME(payment_date)
     ORDER BY MONTH(payment_date)`,
    [schoolId]
  );

  res.json({ success: true, data: { summary, monthly } });
});

exports.getStudentFees = asyncHandler(async (req, res) => {
  const schoolId = req.user.school_id || req.query.school_id;
  const { class_id, academic_year = "2024-25", status } = req.query;

  let where = "WHERE s.school_id = ? AND s.status = 'Active'";
  const params = [schoolId, academic_year, academic_year];

  if (class_id) { where += " AND s.class_id = ?"; params.push(class_id); }

  let having = "";
  if (status === "pending")  having = "HAVING pending > 0";
  if (status === "paid")     having = "HAVING pending <= 0";

  const [rows] = await pool.execute(
    `SELECT s.id, s.student_id, s.name, s.father_name, s.mobile, s.roll_no,
            c.name AS class_name, c.section,
            COALESCE(fs.total_fee, 0) AS total_fee,
            COALESCE(fp.total_paid, 0) AS total_paid,
            COALESCE(fs.total_fee, 0) - COALESCE(fp.total_paid, 0) AS pending
     FROM students s
     JOIN classes c ON c.id = s.class_id
     LEFT JOIN (
       SELECT class_id, SUM(amount) AS total_fee
       FROM fee_structures WHERE academic_year = ? GROUP BY class_id
     ) fs ON fs.class_id = s.class_id
     LEFT JOIN (
       SELECT student_id, SUM(amount) AS total_paid
       FROM fee_payments WHERE academic_year = ? GROUP BY student_id
     ) fp ON fp.student_id = s.id
     ${where}
     ${having}
     ORDER BY s.name`,
    params
  );

  res.json({ success: true, data: rows });
});

exports.addPayment = asyncHandler(async (req, res) => {
  const schoolId = req.user.school_id;
  const {
    student_id, amount, payment_mode = "Cash", fee_type = "Tuition",
    academic_year = "2024-25", month, remarks
  } = req.body;

  if (!student_id || !amount || amount <= 0) {
    return res.status(400).json({ success: false, message: "student_id and amount > 0 required" });
  }

  const [[student]] = await pool.execute(
    "SELECT id FROM students WHERE id = ? AND school_id = ?", [student_id, schoolId]
  );
  if (!student) return res.status(404).json({ success: false, message: "Student not found" });

  const [[{ cnt }]] = await pool.execute("SELECT COUNT(*) AS cnt FROM fee_payments WHERE school_id = ?", [schoolId]);
  const receipt_no = `RCP-${new Date().getFullYear()}-${String(cnt + 1).padStart(4, "0")}`;

  await pool.execute(
    `INSERT INTO fee_payments
      (school_id, student_id, receipt_no, amount, payment_mode, fee_type, academic_year, month, remarks, collected_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [schoolId, student_id, receipt_no, amount, payment_mode, fee_type, academic_year, month || null, remarks || null, req.user.id]
  );

  res.status(201).json({ success: true, message: "Payment recorded", data: { receipt_no } });
});

exports.getReceipt = asyncHandler(async (req, res) => {
  const schoolId = req.user.school_id;

  const [rows] = await pool.execute(
    `SELECT fp.*, s.name AS student_name, s.father_name, s.roll_no,
            c.name AS class_name, c.section,
            sch.name AS school_name, sch.phone AS school_phone, sch.address AS school_address,
            u.name AS collected_by_name
     FROM fee_payments fp
     JOIN students s ON s.id = fp.student_id
     JOIN classes c ON c.id = s.class_id
     JOIN schools sch ON sch.id = fp.school_id
     LEFT JOIN users u ON u.id = fp.collected_by
     WHERE fp.receipt_no = ? AND fp.school_id = ?`,
    [req.params.receiptNo, schoolId]
  );

  if (!rows.length) return res.status(404).json({ success: false, message: "Receipt not found" });
  res.json({ success: true, data: rows[0] });
});

exports.getStudentPayments = asyncHandler(async (req, res) => {
  const schoolId = req.user.school_id;
  const { academic_year = "2024-25" } = req.query;

  const [rows] = await pool.execute(
    `SELECT fp.*, u.name AS collected_by_name
     FROM fee_payments fp
     LEFT JOIN users u ON u.id = fp.collected_by
     WHERE fp.student_id = ? AND fp.school_id = ? AND fp.academic_year = ?
     ORDER BY fp.payment_date DESC`,
    [req.params.studentId, schoolId, academic_year]
  );

  res.json({ success: true, data: rows });
});

exports.getFeeStructures = asyncHandler(async (req, res) => {
  const schoolId = req.user.school_id;
  const { academic_year = "2024-25" } = req.query;

  const [rows] = await pool.execute(
    `SELECT fs.*, c.name AS class_name, c.section
     FROM fee_structures fs
     LEFT JOIN classes c ON c.id = fs.class_id
     WHERE fs.school_id = ? AND fs.academic_year = ?
     ORDER BY fs.fee_type`,
    [schoolId, academic_year]
  );

  res.json({ success: true, data: rows });
});

exports.createFeeStructure = asyncHandler(async (req, res) => {
  const schoolId = req.user.school_id;
  const { class_id, fee_type, amount, due_date, academic_year = "2024-25" } = req.body;

  if (!fee_type || !amount) {
    return res.status(400).json({ success: false, message: "fee_type and amount are required" });
  }

  const [result] = await pool.execute(
    "INSERT INTO fee_structures (school_id, class_id, fee_type, amount, due_date, academic_year) VALUES (?, ?, ?, ?, ?, ?)",
    [schoolId, class_id || null, fee_type, amount, due_date || null, academic_year]
  );

  res.status(201).json({ success: true, message: "Fee structure created", data: { id: result.insertId } });
});

exports.getMonthlyReport = asyncHandler(async (req, res) => {
  const schoolId = req.user.school_id;
  const { year = new Date().getFullYear() } = req.query;

  const [rows] = await pool.execute(
    `SELECT MONTH(payment_date) AS month_num, MONTHNAME(payment_date) AS month_name,
            COUNT(*) AS transactions, SUM(amount) AS total, payment_mode
     FROM fee_payments
     WHERE school_id = ? AND YEAR(payment_date) = ?
     GROUP BY MONTH(payment_date), MONTHNAME(payment_date), payment_mode
     ORDER BY MONTH(payment_date)`,
    [schoolId, year]
  );

  res.json({ success: true, data: rows });
});
