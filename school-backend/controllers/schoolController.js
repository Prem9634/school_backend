const pool = require("../config/db");
const { asyncHandler } = require("../middleware/errorHandler");

exports.getSchools = asyncHandler(async (req, res) => {
  const { status, plan_id, search } = req.query;

  let where = "WHERE 1=1";
  const params = [];
  if (status)  { where += " AND s.status = ?"; params.push(status); }
  if (plan_id) { where += " AND s.plan_id = ?"; params.push(plan_id); }
  if (search)  { where += " AND (s.name LIKE ? OR s.city LIKE ?)"; params.push(`%${search}%`, `%${search}%`); }

  const [rows] = await pool.execute(
    `SELECT s.*, p.name AS plan_name, p.price AS plan_price,
            COUNT(DISTINCT st.id) AS student_count,
            COUNT(DISTINCT u.id) AS user_count
     FROM schools s
     JOIN plans p ON p.id = s.plan_id
     LEFT JOIN students st ON st.school_id = s.id AND st.status = 'Active'
     LEFT JOIN users u ON u.school_id = s.id AND u.status = 'Active'
     ${where}
     GROUP BY s.id
     ORDER BY s.created_at DESC`,
    params
  );

  res.json({ success: true, data: rows });
});

exports.getSchool = asyncHandler(async (req, res) => {
  const [rows] = await pool.execute(
    `SELECT s.*, p.name AS plan_name, p.price AS plan_price, p.max_students, p.features
     FROM schools s JOIN plans p ON p.id = s.plan_id WHERE s.id = ?`,
    [req.params.id]
  );
  if (!rows.length) return res.status(404).json({ success: false, message: "School not found" });
  res.json({ success: true, data: rows[0] });
});

exports.createSchool = asyncHandler(async (req, res) => {
  const { name, city, state, address, phone, email, established, plan_id, status = "Trial" } = req.body;

  if (!name || !city || !plan_id) {
    return res.status(400).json({ success: false, message: "name, city, plan_id are required" });
  }

  const [[plan]] = await pool.execute("SELECT id FROM plans WHERE id = ?", [plan_id]);
  if (!plan) return res.status(400).json({ success: false, message: "Invalid plan" });

  const trialEnds = new Date();
  trialEnds.setDate(trialEnds.getDate() + 30);

  const [result] = await pool.execute(
    `INSERT INTO schools (name, city, state, address, phone, email, established, plan_id, status, trial_ends_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [name, city, state || null, address || null, phone || null, email || null,
     established || null, plan_id, status, trialEnds.toISOString().split("T")[0]]
  );

  res.status(201).json({ success: true, message: "School registered", data: { id: result.insertId } });
});

exports.updateSchool = asyncHandler(async (req, res) => {
  const { name, city, state, address, phone, email, established, plan_id, status } = req.body;
  const [result] = await pool.execute(
    `UPDATE schools SET name=?, city=?, state=?, address=?, phone=?, email=?,
     established=?, plan_id=?, status=?, updated_at=NOW() WHERE id=?`,
    [name, city, state || null, address || null, phone || null, email || null,
     established || null, plan_id, status, req.params.id]
  );
  if (!result.affectedRows) return res.status(404).json({ success: false, message: "School not found" });
  res.json({ success: true, message: "School updated" });
});

exports.deleteSchool = asyncHandler(async (req, res) => {
  await pool.execute("UPDATE schools SET status = 'Inactive' WHERE id = ?", [req.params.id]);
  res.json({ success: true, message: "School deactivated" });
});

exports.getGlobalAnalytics = asyncHandler(async (req, res) => {
  const [[counts]] = await pool.execute(
    `SELECT
       COUNT(*) AS total_schools,
       SUM(status = 'Active') AS active_schools,
       SUM(status = 'Inactive') AS inactive_schools,
       SUM(status = 'Trial') AS trial_schools
     FROM schools`
  );

  const [planDist] = await pool.execute(
    `SELECT p.name AS plan, COUNT(s.id) AS count, p.price,
            COUNT(s.id) * p.price AS revenue
     FROM schools s JOIN plans p ON p.id = s.plan_id
     WHERE s.status = 'Active'
     GROUP BY p.id, p.name, p.price`
  );

  const [[studentCount]] = await pool.execute("SELECT SUM(id) AS total FROM students WHERE status = 'Active'");

  const [recentSchools] = await pool.execute(
    "SELECT s.id, s.name, s.city, s.status, p.name AS plan FROM schools s JOIN plans p ON p.id = s.plan_id ORDER BY s.created_at DESC LIMIT 5"
  );

  res.json({ success: true, data: { counts, planDist, recentSchools } });
});
