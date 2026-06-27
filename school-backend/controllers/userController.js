const bcrypt = require("bcryptjs");
const pool = require("../config/db");
const { asyncHandler } = require("../middleware/errorHandler");

exports.getUsers = asyncHandler(async (req, res) => {
  const schoolId = req.user.role === "admin" ? (req.query.school_id || null) : req.user.school_id;
  const { role, status = "Active" } = req.query;

  let where = "WHERE 1=1";
  const params = [];
  if (schoolId) { where += " AND u.school_id = ?"; params.push(schoolId); }
  if (role)     { where += " AND u.role = ?";       params.push(role); }
  if (status)   { where += " AND u.status = ?";     params.push(status); }

  const [rows] = await pool.execute(
    `SELECT u.id, u.name, u.email, u.role, u.phone, u.status, u.last_login, u.created_at,
            s.name AS school_name
     FROM users u
     LEFT JOIN schools s ON s.id = u.school_id
     ${where}
     ORDER BY u.role, u.name`,
    params
  );

  res.json({ success: true, data: rows });
});

exports.getUser = asyncHandler(async (req, res) => {
  const [rows] = await pool.execute(
    `SELECT u.id, u.name, u.email, u.role, u.phone, u.status, u.last_login, u.avatar_url,
            u.school_id, s.name AS school_name
     FROM users u LEFT JOIN schools s ON s.id = u.school_id
     WHERE u.id = ?`,
    [req.params.id]
  );
  if (!rows.length) return res.status(404).json({ success: false, message: "User not found" });
  res.json({ success: true, data: rows[0] });
});

exports.createUser = asyncHandler(async (req, res) => {
  const { name, email, password, role, phone, school_id } = req.body;

  if (!name || !email || !password || !role) {
    return res.status(400).json({ success: false, message: "name, email, password, role are required" });
  }

  const targetSchoolId = req.user.role === "admin" ? (school_id || null) : req.user.school_id;

  if (role === "admin" && req.user.role !== "admin") {
    return res.status(403).json({ success: false, message: "Only super admin can create admin accounts" });
  }

  const hash = await bcrypt.hash(password, 12);

  const [result] = await pool.execute(
    "INSERT INTO users (school_id, name, email, password_hash, role, phone) VALUES (?, ?, ?, ?, ?, ?)",
    [targetSchoolId, name, email.toLowerCase().trim(), hash, role, phone || null]
  );

  res.status(201).json({ success: true, message: "User created successfully", data: { id: result.insertId } });
});

exports.updateUser = asyncHandler(async (req, res) => {
  const { name, phone, status, role } = req.body;

  if (role === "admin" && req.user.role !== "admin") {
    return res.status(403).json({ success: false, message: "Cannot assign admin role" });
  }

  const [result] = await pool.execute(
    "UPDATE users SET name = ?, phone = ?, status = ?, role = ?, updated_at = NOW() WHERE id = ?",
    [name, phone || null, status || "Active", role, req.params.id]
  );

  if (!result.affectedRows) return res.status(404).json({ success: false, message: "User not found" });
  res.json({ success: true, message: "User updated" });
});

exports.deleteUser = asyncHandler(async (req, res) => {
  if (parseInt(req.params.id) === req.user.id) {
    return res.status(400).json({ success: false, message: "Cannot delete your own account" });
  }
  await pool.execute("UPDATE users SET status = 'Inactive' WHERE id = ?", [req.params.id]);
  res.json({ success: true, message: "User deactivated" });
});

exports.resetPassword = asyncHandler(async (req, res) => {
  const { new_password } = req.body;
  if (!new_password || new_password.length < 6) {
    return res.status(400).json({ success: false, message: "New password must be at least 6 characters" });
  }
  const hash = await bcrypt.hash(new_password, 12);
  await pool.execute("UPDATE users SET password_hash = ?, refresh_token = NULL WHERE id = ?", [hash, req.params.id]);
  res.json({ success: true, message: "Password reset successfully" });
});
