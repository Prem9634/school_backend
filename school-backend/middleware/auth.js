const jwt = require("jsonwebtoken");
const pool = require("../config/db");
const logger = require("../utils/logger");

// ─── Verify Access Token ──────────────────────────────────────────────────────
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ success: false, message: "Access token required" });
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const [rows] = await pool.execute(
      "SELECT id, school_id, name, email, role, status FROM users WHERE id = ?",
      [decoded.id]
    );

    if (!rows.length || rows[0].status !== "Active") {
      return res.status(401).json({ success: false, message: "User not found or deactivated" });
    }

    req.user = rows[0];
    next();
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      return res.status(401).json({ success: false, message: "Token expired", code: "TOKEN_EXPIRED" });
    }
    logger.error("Auth middleware error:", err.message);
    return res.status(401).json({ success: false, message: "Invalid token" });
  }
};

// ─── Role-Based Access Control ────────────────────────────────────────────────
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Access denied. Required role: ${roles.join(" or ")}`,
      });
    }
    next();
  };
};

// ─── School Scope Guard ───────────────────────────────────────────────────────
const schoolScope = (req, res, next) => {
  if (req.user.role === "admin") return next();

  const schoolId = parseInt(req.params.schoolId || req.body.school_id || req.query.school_id);

  if (schoolId && schoolId !== req.user.school_id) {
    return res.status(403).json({ success: false, message: "Access to this school is not permitted" });
  }

  req.schoolId = req.user.school_id;
  next();
};

// ─── Optional Auth ────────────────────────────────────────────────────────────
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.split(" ")[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const [rows] = await pool.execute(
        "SELECT id, school_id, name, email, role FROM users WHERE id = ? AND status = 'Active'",
        [decoded.id]
      );
      if (rows.length) req.user = rows[0];
    }
  } catch (_) {}
  next();
};

module.exports = { authenticate, authorize, schoolScope, optionalAuth };
