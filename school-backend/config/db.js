const mysql = require("mysql2/promise");
const logger = require("../utils/logger");

const pool = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "edumanage_saas",
  waitForConnections: true,
  connectionLimit: 20,
  queueLimit: 0,
  timezone: "+05:30",
  charset: "utf8mb4",
  connectTimeout: 10000,
});

const testConnection = async () => {
  try {
    const conn = await pool.getConnection();
    logger.info("✅ MySQL connected successfully");
    conn.release();
  } catch (err) {
    logger.error("❌ MySQL connection failed:", err.message);
    process.exit(1);
  }
};

testConnection();

module.exports = pool;
