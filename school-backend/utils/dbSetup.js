/**
 * Run: node utils/dbSetup.js
 * Reads schema.sql and executes it against MySQL
 */
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const mysql = require("mysql2/promise");

async function setup() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
connectTimeout: 30000,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    multipleStatements: true,
});

  console.log("✅ Connected to MySQL");

  const schema = fs.readFileSync(path.join(__dirname, "../config/schema.sql"), "utf8");
  await conn.query(schema);

  console.log("✅ Database schema created successfully");
  console.log("✅ Default data seeded");
  console.log("\n🔑 Default super admin:");
  console.log("   Email:    admin@saas.com");
  console.log("   Password: admin123");
  console.log("\n🚀 Run: npm run db:seed  to add sample school data");

  await conn.end();
}

setup().catch(err => {
  console.error("❌ Setup failed:", err.message);
  process.exit(1);
});
