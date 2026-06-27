const pool = require("../config/db");
const { asyncHandler } = require("../middleware/errorHandler");

exports.getSettings = asyncHandler(async (req, res) => {
  const [rows] = await pool.execute("SELECT * FROM platform_settings ORDER BY setting_key");
  const settings = {};
  rows.forEach(r => { settings[r.setting_key] = r.setting_value; });
  res.json({ success: true, data: settings });
});

exports.updateSettings = asyncHandler(async (req, res) => {
  const updates = req.body;
  const conn = await pool.getConnection();
  await conn.beginTransaction();
  try {
    for (const [key, value] of Object.entries(updates)) {
      await conn.execute(
        "INSERT INTO platform_settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)",
        [key, String(value)]
      );
    }
    await conn.commit();
    res.json({ success: true, message: "Settings saved" });
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
});

exports.getPlans = asyncHandler(async (req, res) => {
  const [rows] = await pool.execute("SELECT * FROM plans WHERE is_active = 1 ORDER BY price");
  res.json({ success: true, data: rows });
});

exports.createPlan = asyncHandler(async (req, res) => {
  const { name, price, max_students, max_users, features } = req.body;
  if (!name || !price) return res.status(400).json({ success: false, message: "name and price required" });

  const [result] = await pool.execute(
    "INSERT INTO plans (name, price, max_students, max_users, features) VALUES (?, ?, ?, ?, ?)",
    [name, price, max_students || 300, max_users || 5, JSON.stringify(features || [])]
  );
  res.status(201).json({ success: true, message: "Plan created", data: { id: result.insertId } });
});

exports.updatePlan = asyncHandler(async (req, res) => {
  const { name, price, max_students, max_users, features, is_active } = req.body;
  await pool.execute(
    "UPDATE plans SET name=?, price=?, max_students=?, max_users=?, features=?, is_active=? WHERE id=?",
    [name, price, max_students, max_users, JSON.stringify(features || []), is_active ?? 1, req.params.id]
  );
  res.json({ success: true, message: "Plan updated" });
});

exports.getBackupStatus = asyncHandler(async (req, res) => {
  res.json({
    success: true,
    data: {
      last_backup: new Date().toISOString(),
      status: "success",
      size: "24.6 MB",
      message: "Database backup feature: integrate with your backup service (AWS S3, GCP, etc.)",
    },
  });
});
