-- ═══════════════════════════════════════════════════════════════════════════
-- EduManage SaaS - Complete MySQL Database Schema
-- ═══════════════════════════════════════════════════════════════════════════

CREATE DATABASE IF NOT EXISTS edumanage_saas
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE edumanage_saas;

-- ─── SUBSCRIPTION PLANS ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS plans (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  name            VARCHAR(50)    NOT NULL UNIQUE,
  price           DECIMAL(10,2)  NOT NULL DEFAULT 0,
  max_students    INT            NOT NULL DEFAULT 300,
  max_users       INT            NOT NULL DEFAULT 5,
  features        JSON,
  is_active       TINYINT(1)     NOT NULL DEFAULT 1,
  created_at      TIMESTAMP      DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP      DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ─── SCHOOLS ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS schools (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  name            VARCHAR(200)   NOT NULL,
  city            VARCHAR(100)   NOT NULL,
  state           VARCHAR(100),
  address         TEXT,
  phone           VARCHAR(20),
  email           VARCHAR(150),
  established     YEAR,
  plan_id         INT            NOT NULL,
  status          ENUM('Active','Inactive','Trial') NOT NULL DEFAULT 'Trial',
  logo_url        VARCHAR(500),
  trial_ends_at   DATE,
  created_at      TIMESTAMP      DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP      DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (plan_id) REFERENCES plans(id) ON UPDATE CASCADE
);

-- ─── USERS (all roles) ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  school_id       INT,
  name            VARCHAR(150)   NOT NULL,
  email           VARCHAR(150)   NOT NULL UNIQUE,
  password_hash   VARCHAR(255)   NOT NULL,
  role            ENUM('admin','principal','teacher','accountant','student') NOT NULL,
  status          ENUM('Active','Inactive')       NOT NULL DEFAULT 'Active',
  phone           VARCHAR(20),
  avatar_url      VARCHAR(500),
  last_login      TIMESTAMP      NULL,
  refresh_token   TEXT,
  created_at      TIMESTAMP      DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP      DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE ON UPDATE CASCADE,
  INDEX idx_email (email),
  INDEX idx_school_role (school_id, role)
);

-- ─── CLASSES & SECTIONS ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS classes (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  school_id       INT            NOT NULL,
  name            VARCHAR(50)    NOT NULL,
  section         VARCHAR(10)    NOT NULL,
  room            VARCHAR(20),
  class_teacher_id INT,
  academic_year   VARCHAR(10)    NOT NULL DEFAULT '2024-25',
  created_at      TIMESTAMP      DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP      DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
  FOREIGN KEY (class_teacher_id) REFERENCES users(id) ON DELETE SET NULL,
  UNIQUE KEY uq_class_section_year (school_id, name, section, academic_year),
  INDEX idx_school_class (school_id)
);

-- ─── SUBJECTS ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS subjects (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  school_id       INT            NOT NULL,
  class_id        INT            NOT NULL,
  name            VARCHAR(100)   NOT NULL,
  code            VARCHAR(20),
  teacher_id      INT,
  max_marks       INT            NOT NULL DEFAULT 100,
  created_at      TIMESTAMP      DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
  FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE,
  FOREIGN KEY (teacher_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_class_subject (class_id)
);

-- ─── STUDENTS ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS students (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  school_id       INT            NOT NULL,
  user_id         INT            UNIQUE,
  student_id      VARCHAR(20)    NOT NULL,
  class_id        INT            NOT NULL,
  roll_no         VARCHAR(10)    NOT NULL,
  name            VARCHAR(150)   NOT NULL,
  gender          ENUM('Male','Female','Other')   NOT NULL,
  dob             DATE           NOT NULL,
  father_name     VARCHAR(150)   NOT NULL,
  mother_name     VARCHAR(150),
  mobile          VARCHAR(20)    NOT NULL,
  alt_mobile      VARCHAR(20),
  address         TEXT,
  photo_url       VARCHAR(500),
  academic_year   VARCHAR(10)    NOT NULL DEFAULT '2024-25',
  status          ENUM('Active','Inactive','Transferred') NOT NULL DEFAULT 'Active',
  created_at      TIMESTAMP      DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP      DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
  FOREIGN KEY (class_id) REFERENCES classes(id) ON UPDATE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  UNIQUE KEY uq_student_id_school (student_id, school_id),
  INDEX idx_school_student (school_id),
  INDEX idx_class_student (class_id)
);

-- ─── FEES ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS fee_structures (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  school_id       INT            NOT NULL,
  class_id        INT,
  academic_year   VARCHAR(10)    NOT NULL DEFAULT '2024-25',
  fee_type        VARCHAR(100)   NOT NULL,
  amount          DECIMAL(10,2)  NOT NULL,
  due_date        DATE,
  created_at      TIMESTAMP      DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
  FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE SET NULL,
  INDEX idx_school_fee (school_id, academic_year)
);

CREATE TABLE IF NOT EXISTS fee_payments (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  school_id       INT            NOT NULL,
  student_id      INT            NOT NULL,
  receipt_no      VARCHAR(50)    NOT NULL UNIQUE,
  payment_date    DATE           NOT NULL DEFAULT (CURDATE()),
  amount          DECIMAL(10,2)  NOT NULL,
  payment_mode    ENUM('Cash','Online','Cheque','DD') NOT NULL DEFAULT 'Cash',
  fee_type        VARCHAR(100)   NOT NULL,
  academic_year   VARCHAR(10)    NOT NULL DEFAULT '2024-25',
  month           VARCHAR(20),
  remarks         TEXT,
  collected_by    INT,
  created_at      TIMESTAMP      DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP      DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  FOREIGN KEY (collected_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_student_fee (student_id),
  INDEX idx_school_fee_payment (school_id, payment_date)
);

-- ─── ATTENDANCE ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS attendance (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  school_id       INT            NOT NULL,
  student_id      INT            NOT NULL,
  class_id        INT            NOT NULL,
  date            DATE           NOT NULL,
  status          ENUM('Present','Absent','Late','Holiday') NOT NULL DEFAULT 'Present',
  marked_by       INT,
  remarks         VARCHAR(255),
  created_at      TIMESTAMP      DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP      DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE,
  FOREIGN KEY (marked_by) REFERENCES users(id) ON DELETE SET NULL,
  UNIQUE KEY uq_attendance (student_id, date),
  INDEX idx_class_date (class_id, date),
  INDEX idx_school_date (school_id, date)
);

-- ─── MARKS / RESULTS ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS marks (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  school_id       INT            NOT NULL,
  student_id      INT            NOT NULL,
  subject_id      INT            NOT NULL,
  class_id        INT            NOT NULL,
  exam_type       VARCHAR(50)    NOT NULL DEFAULT 'Annual',
  academic_year   VARCHAR(10)    NOT NULL DEFAULT '2024-25',
  marks_obtained  DECIMAL(5,2)   NOT NULL DEFAULT 0,
  max_marks       INT            NOT NULL DEFAULT 100,
  grade           VARCHAR(5),
  remarks         VARCHAR(255),
  entered_by      INT,
  created_at      TIMESTAMP      DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP      DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE,
  FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE,
  FOREIGN KEY (entered_by) REFERENCES users(id) ON DELETE SET NULL,
  UNIQUE KEY uq_marks (student_id, subject_id, exam_type, academic_year),
  INDEX idx_student_marks (student_id, academic_year)
);

-- ─── HOMEWORK ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS homework (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  school_id       INT            NOT NULL,
  class_id        INT            NOT NULL,
  subject_id      INT,
  title           VARCHAR(200)   NOT NULL,
  description     TEXT,
  due_date        DATE           NOT NULL,
  assigned_by     INT            NOT NULL,
  attachment_url  VARCHAR(500),
  status          ENUM('Active','Closed') NOT NULL DEFAULT 'Active',
  created_at      TIMESTAMP      DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP      DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
  FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE,
  FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE SET NULL,
  FOREIGN KEY (assigned_by) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_class_hw (class_id, due_date),
  INDEX idx_school_hw (school_id)
);

-- ─── SMS LOGS ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sms_logs (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  school_id       INT            NOT NULL,
  sent_by         INT,
  recipient_type  VARCHAR(50),
  class_id        INT,
  message         TEXT           NOT NULL,
  recipient_count INT            NOT NULL DEFAULT 0,
  status          ENUM('Sent','Failed','Pending') NOT NULL DEFAULT 'Sent',
  created_at      TIMESTAMP      DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
  FOREIGN KEY (sent_by) REFERENCES users(id) ON DELETE SET NULL
);

-- ─── PLATFORM SETTINGS ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS platform_settings (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  setting_key     VARCHAR(100)   NOT NULL UNIQUE,
  setting_value   TEXT,
  description     VARCHAR(255),
  updated_at      TIMESTAMP      DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ─── AUDIT LOGS ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_logs (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  user_id         INT,
  school_id       INT,
  action          VARCHAR(100)   NOT NULL,
  entity          VARCHAR(50),
  entity_id       INT,
  old_values      JSON,
  new_values      JSON,
  ip_address      VARCHAR(50),
  user_agent      VARCHAR(500),
  created_at      TIMESTAMP      DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user_audit (user_id, created_at),
  INDEX idx_school_audit (school_id, created_at)
);

-- ─── DEFAULT DATA ─────────────────────────────────────────────────────────────

INSERT IGNORE INTO plans (name, price, max_students, max_users, features) VALUES
('Basic',      999.00,  300,       5,         '["Student Management","Fee Tracking","Attendance","5 Users"]'),
('Pro',        2499.00, 1000,      20,        '["All Basic Features","ID Card Generator","SMS Notifications","20 Users","Analytics"]'),
('Enterprise', 5999.00, 2147483647, 2147483647,'["All Pro Features","Multi-Branch","API Access","Unlimited Users","Dedicated Support","Custom Branding"]');

INSERT IGNORE INTO platform_settings (setting_key, setting_value, description) VALUES
('platform_name',    'EduManage SaaS',        'Platform display name'),
('support_email',    'support@edumanage.com', 'Support contact email'),
('trial_days',       '30',                    'Free trial duration in days'),
('sms_enabled',      'true',                  'Enable SMS notifications'),
('id_card_enabled',  'true',                  'Enable ID card generator'),
('fee_reminders',    'true',                  'Enable automatic fee reminders'),
('parent_portal',    'false',                 'Enable parent portal'),
('analytics',        'true',                  'Enable analytics dashboard');

-- Default super-admin (password: admin123)
INSERT IGNORE INTO users (school_id, name, email, password_hash, role, status)
VALUES (NULL, 'SuperAdmin', 'admin@saas.com',
  '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQyCRe8.9gzW6CqLhHKTn/1vi', 'admin', 'Active');
