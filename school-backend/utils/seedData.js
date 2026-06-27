/**
 * Run: node utils/seedData.js
 * Creates a complete sample school matching the frontend demo data
 */
require("dotenv").config();
const bcrypt = require("bcryptjs");
const mysql = require("mysql2/promise");

async function seed() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || "localhost",
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "edumanage_saas",
    multipleStatements: false,
  });

  console.log("🌱 Seeding sample data...\n");

  const [schoolResult] = await conn.execute(
    `INSERT IGNORE INTO schools (name, city, state, phone, email, established, plan_id, status)
     VALUES ('Sunrise Public School', 'Delhi', 'Delhi', '011-12345678', 'info@sunrise.edu', 2005, 2, 'Active')`
  );
  const schoolId = schoolResult.insertId || 1;

  const hash = async (p) => bcrypt.hash(p, 12);

  const users = [
    { name: "Dr. S. K. Mishra", email: "principal@school.com", password: "principal123", role: "principal" },
    { name: "Kavita Singh",     email: "teacher@school.com",   password: "teacher123",   role: "teacher" },
    { name: "Ramesh Kumar",     email: "ramesh@school.com",    password: "teacher123",   role: "teacher" },
    { name: "Pooja Mehta",      email: "accountant@school.com",password: "acc123",       role: "accountant" },
    { name: "Aarav Sharma",     email: "student@school.com",   password: "student123",   role: "student" },
  ];

  const userIds = {};
  for (const u of users) {
    const [r] = await conn.execute(
      "INSERT IGNORE INTO users (school_id, name, email, password_hash, role) VALUES (?, ?, ?, ?, ?)",
      [schoolId, u.name, u.email, await hash(u.password), u.role]
    );
    if (r.insertId) userIds[u.email] = r.insertId;
    else {
      const [[existing]] = await conn.execute("SELECT id FROM users WHERE email = ?", [u.email]);
      userIds[u.email] = existing?.id;
    }
  }

  const classData = [
    { name: "Class 10", section: "A", room: "101", teacher: "teacher@school.com" },
    { name: "Class 9",  section: "B", room: "205", teacher: "ramesh@school.com" },
    { name: "Class 8",  section: "C", room: "302" },
    { name: "Class 7",  section: "A", room: "103" },
  ];
  const classIds = {};
  for (const c of classData) {
    const [r] = await conn.execute(
      "INSERT IGNORE INTO classes (school_id, name, section, room, class_teacher_id) VALUES (?, ?, ?, ?, ?)",
      [schoolId, c.name, c.section, c.room, userIds[c.teacher] || null]
    );
    const key = `${c.name}-${c.section}`;
    if (r.insertId) classIds[key] = r.insertId;
    else {
      const [[ex]] = await conn.execute("SELECT id FROM classes WHERE school_id=? AND name=? AND section=?", [schoolId, c.name, c.section]);
      classIds[key] = ex?.id;
    }
  }

  const subjects10A = ["Hindi","English","Maths","Science","SST"];
  const subjectIds = {};
  for (const s of subjects10A) {
    const [r] = await conn.execute(
      "INSERT IGNORE INTO subjects (school_id, class_id, name, teacher_id) VALUES (?, ?, ?, ?)",
      [schoolId, classIds["Class 10-A"], s, userIds["teacher@school.com"]]
    );
    subjectIds[s] = r.insertId || (await conn.execute("SELECT id FROM subjects WHERE class_id=? AND name=?", [classIds["Class 10-A"], s]))[0][0]?.id;
  }

  await conn.execute(
    "INSERT IGNORE INTO fee_structures (school_id, class_id, fee_type, amount) VALUES (?,?,?,?),(?,?,?,?),(?,?,?,?)",
    [schoolId, classIds["Class 10-A"], "Tuition", 8400,
     schoolId, classIds["Class 10-A"], "Activity", 2400,
     schoolId, classIds["Class 10-A"], "Exam",     1200]
  );

  const students = [
    { student_id:"STU001", name:"Aarav Sharma",  class:"Class 10-A", roll:"01", gender:"Male",   dob:"2008-05-14", father:"Rajesh Sharma",   mobile:"9876543210", user: "student@school.com",
      marks: {Hindi:88,English:92,Maths:95,Science:89,SST:85}, paid: 12000 },
    { student_id:"STU002", name:"Priya Patel",   class:"Class 10-A", roll:"02", gender:"Female", dob:"2008-09-22", father:"Suresh Patel",     mobile:"9876543211",
      marks: {Hindi:92,English:88,Maths:78,Science:83,SST:90}, paid: 8000 },
    { student_id:"STU003", name:"Rahul Verma",   class:"Class 9-B",  roll:"15", gender:"Male",   dob:"2009-03-10", father:"Vikram Verma",     mobile:"9876543212",
      marks: {}, paid: 10000 },
    { student_id:"STU004", name:"Sneha Gupta",   class:"Class 9-B",  roll:"16", gender:"Female", dob:"2009-07-18", father:"Amit Gupta",       mobile:"9876543213",
      marks: {}, paid: 5000 },
    { student_id:"STU005", name:"Karan Singh",   class:"Class 8-C",  roll:"08", gender:"Male",   dob:"2010-01-25", father:"Harpreet Singh",   mobile:"9876543214",
      marks: {}, paid: 9000 },
    { student_id:"STU006", name:"Ananya Joshi",  class:"Class 8-C",  roll:"09", gender:"Female", dob:"2010-04-30", father:"Pradeep Joshi",    mobile:"9876543215",
      marks: {}, paid: 0 },
  ];

  for (const s of students) {
    const [r] = await conn.execute(
      `INSERT IGNORE INTO students (school_id, user_id, student_id, class_id, roll_no, name, gender, dob, father_name, mobile)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [schoolId, userIds[s.user] || null, s.student_id, classIds[s.class],
       s.roll, s.name, s.gender, s.dob, s.father, s.mobile]
    );
    const studentDbId = r.insertId || (await conn.execute("SELECT id FROM students WHERE student_id=? AND school_id=?", [s.student_id, schoolId]))[0][0]?.id;

    for (const [subName, obtained] of Object.entries(s.marks)) {
      if (subjectIds[subName]) {
        await conn.execute(
          `INSERT IGNORE INTO marks (school_id, student_id, subject_id, class_id, exam_type, marks_obtained, max_marks, grade, entered_by)
           VALUES (?, ?, ?, ?, 'Annual', ?, 100, ?, ?)`,
          [schoolId, studentDbId, subjectIds[subName], classIds["Class 10-A"], obtained,
           obtained >= 90 ? "A+" : obtained >= 80 ? "A" : obtained >= 70 ? "B+" : "B",
           userIds["teacher@school.com"]]
        );
      }
    }

    if (s.paid > 0) {
      const receiptNo = `RCP-2024-${s.student_id.slice(-3)}`;
      await conn.execute(
        `INSERT IGNORE INTO fee_payments (school_id, student_id, receipt_no, amount, payment_mode, fee_type, collected_by)
         VALUES (?, ?, ?, ?, 'Cash', 'Tuition', ?)`,
        [schoolId, studentDbId, receiptNo, s.paid, userIds["accountant@school.com"]]
      );
    }

    const today = new Date();
    for (let i = 1; i <= 30; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      if (d.getDay() === 0 || d.getDay() === 6) continue;
      const status = Math.random() > 0.12 ? "Present" : "Absent";
      const dateStr = d.toISOString().split("T")[0];
      await conn.execute(
        `INSERT IGNORE INTO attendance (school_id, student_id, class_id, date, status, marked_by)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [schoolId, studentDbId, classIds[s.class], dateStr, status, userIds["teacher@school.com"]]
      ).catch(() => {});
    }
  }

  await conn.execute(
    `INSERT IGNORE INTO homework (school_id, class_id, subject_id, title, description, due_date, assigned_by)
     VALUES (?, ?, ?, 'Chapter 5 Exercise', 'Complete all sums from pg 45-48', DATE_ADD(CURDATE(), INTERVAL 5 DAY), ?)`,
    [schoolId, classIds["Class 10-A"], subjectIds["Maths"], userIds["teacher@school.com"]]
  );

  console.log("✅ Sample school: Sunrise Public School (Delhi)");
  console.log("✅ 5 users created");
  console.log("✅ 4 classes, 5 subjects created");
  console.log("✅ 6 students with marks, fees, attendance");
  console.log("\n🔑 Login credentials:");
  console.log("   Admin:      admin@saas.com       / admin123");
  console.log("   Principal:  principal@school.com  / principal123");
  console.log("   Teacher:    teacher@school.com    / teacher123");
  console.log("   Accountant: accountant@school.com / acc123");
  console.log("   Student:    student@school.com    / student123");

  await conn.end();
}

seed().catch(err => {
  console.error("❌ Seed failed:", err.message);
  process.exit(1);
});
