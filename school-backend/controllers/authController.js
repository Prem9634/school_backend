const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const pool = require("../config/db");
const logger = require("../utils/logger");
const { asyncHandler } = require("../middleware/errorHandler");

const generateTokens = (user) => {
  const payload = { id: user.id, role: user.role, school_id: user.school_id };

  const accessToken = jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || "7d",
  });

  const refreshToken = jwt.sign(payload, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRE || "30d",
  });

  return { accessToken, refreshToken };
};

exports.login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ success: false, message: "Email and password are required" });
  }

  const [rows] = await pool.execute(
    `SELECT u.*, s.name AS school_name, s.status AS school_status
     FROM users u
     LEFT JOIN schools s ON u.school_id = s.id
     WHERE u.email = ?`,
    [email.toLowerCase().trim()]
  );

  if (!rows.length) {
    return res.status(401).json({ success: false, message: "Invalid credentials" });
  }

  const user = rows[0];

  if (user.status !== "Active") {
    return res.status(403).json({ success: false, message: "Your account has been deactivated. Contact admin." });
  }

  if (user.school_id && user.school_status === "Inactive") {
    return res.status(403).json({ success: false, message: "School subscription is inactive. Contact admin." });
  }

  const isMatch = await bcrypt.compare(password, user.password_hash);
  if (!isMatch) {
    return res.status(401).json({ success: false, message: "Invalid credentials" });
  }

  const { accessToken, refreshToken } = generateTokens(user);

  await pool.execute(
    "UPDATE users SET refresh_token = ?, last_login = NOW() WHERE id = ?",
    [refreshToken, user.id]
  );

  logger.info(`User ${user.email} logged in successfully`);

  res.json({
    success: true,
    message: "Login successful",
    data: {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        school_id: user.school_id,
        school_name: user.school_name,
        avatar_url: user.avatar_url,
      },
    },
  });
});

exports.refreshToken = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return res.status(400).json({ success: false, message: "Refresh token required" });
  }

  let decoded;
  try {
    decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
  } catch {
    return res.status(401).json({ success: false, message: "Invalid or expired refresh token" });
  }

  const [rows] = await pool.execute(
    "SELECT id, school_id, name, email, role, status, refresh_token FROM users WHERE id = ?",
    [decoded.id]
  );

  if (!rows.length || rows[0].refresh_token !== refreshToken) {
    return res.status(401).json({ success: false, message: "Refresh token mismatch" });
  }

  const user = rows[0];
  const { accessToken, refreshToken: newRefreshToken } = generateTokens(user);

  await pool.execute("UPDATE users SET refresh_token = ? WHERE id = ?", [newRefreshToken, user.id]);

  res.json({ success: true, data: { accessToken, refreshToken: newRefreshToken } });
});

exports.logout = asyncHandler(async (req, res) => {
  await pool.execute("UPDATE users SET refresh_token = NULL WHERE id = ?", [req.user.id]);
  res.json({ success: true, message: "Logged out successfully" });
});

exports.getMe = asyncHandler(async (req, res) => {
  const [rows] = await pool.execute(
    `SELECT u.id, u.name, u.email, u.role, u.phone, u.avatar_url, u.last_login,
            u.school_id, s.name AS school_name, s.city
     FROM users u
     LEFT JOIN schools s ON u.school_id = s.id
     WHERE u.id = ?`,
    [req.user.id]
  );

  res.json({ success: true, data: rows[0] });
});

exports.changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword || newPassword.length < 6) {
    return res.status(400).json({ success: false, message: "Current password and new password (min 6 chars) required" });
  }

  const [rows] = await pool.execute("SELECT password_hash FROM users WHERE id = ?", [req.user.id]);
  const isMatch = await bcrypt.compare(currentPassword, rows[0].password_hash);

  if (!isMatch) {
    return res.status(400).json({ success: false, message: "Current password is incorrect" });
  }

  const hash = await bcrypt.hash(newPassword, 12);
  await pool.execute("UPDATE users SET password_hash = ?, refresh_token = NULL WHERE id = ?", [hash, req.user.id]);

  res.json({ success: true, message: "Password changed successfully. Please login again." });
});
