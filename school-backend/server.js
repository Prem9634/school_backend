require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const compression = require("compression");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");
const path = require("path");
const fs = require("fs");

const logger = require("./utils/logger");
const { notFound, errorHandler } = require("./middleware/errorHandler");

const logsDir = path.join(__dirname, "logs");
if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });

const app = express();

app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
}));

app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:3000",
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));

const limiter = rateLimit({
  windowMs: (parseInt(process.env.RATE_LIMIT_WINDOW) || 15) * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX) || 100,
  message: { success: false, message: "Too many requests. Please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { success: false, message: "Too many login attempts. Please try again after 15 minutes." },
});

app.use("/api/", limiter);
app.use("/api/auth/login", authLimiter);

app.use(compression());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

if (process.env.NODE_ENV !== "test") {
  app.use(morgan("combined", {
    stream: { write: (msg) => logger.info(msg.trim()) },
    skip: (req) => req.url === "/api/health",
  }));
}

app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    status: "healthy",
    service: "EduManage SaaS API",
    version: "1.0.0",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
  });
});

app.use("/api/auth",       require("./routes/auth"));
app.use("/api/students",   require("./routes/students"));
app.use("/api/fees",       require("./routes/fees"));
app.use("/api/attendance", require("./routes/attendance").attendanceRouter);
app.use("/api/marks",      require("./routes/marks"));
app.use("/api/homework",   require("./routes/homework"));
app.use("/api/classes",    require("./routes/classes"));
app.use("/api/users",      require("./routes/users"));
app.use("/api/schools",    require("./routes/schools"));
app.use("/api/settings",   require("./routes/settings"));
app.use("/api/sms",        require("./routes/sms"));

app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () => {
  logger.info(`🚀 EduManage SaaS API running on port ${PORT} [${process.env.NODE_ENV || "development"}]`);
  logger.info(`📚 API Base: http://localhost:${PORT}/api`);
  logger.info(`❤️  Health:  http://localhost:${PORT}/api/health`);
});

const shutdown = async (signal) => {
  logger.info(`${signal} received. Shutting down gracefully...`);
  server.close(() => {
    logger.info("HTTP server closed.");
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10000);
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT",  () => shutdown("SIGINT"));
process.on("uncaughtException",  (err) => { logger.error("Uncaught Exception:", err); process.exit(1); });
process.on("unhandledRejection", (err) => { logger.error("Unhandled Rejection:", err); process.exit(1); });

module.exports = app;
