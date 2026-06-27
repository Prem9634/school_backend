# EduManage SaaS — Backend API

Production-ready Node.js + Express + MySQL backend for the EduManage School Management SaaS.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js 18+ |
| Framework | Express.js 4 |
| Database | MySQL 8+ (mysql2 driver) |
| Auth | JWT (access + refresh tokens) |
| Security | Helmet, CORS, Rate Limiting, bcryptjs |
| Logging | Winston |

---

## Quick Setup

```bash
cd school-backend
npm install
cp .env.example .env        # edit with your MySQL credentials & JWT secrets
npm run db:setup            # creates database + schema
npm run db:seed             # adds sample school + demo users
npm run dev                 # starts server on http://localhost:5000
```

## Default Credentials (after seeding)

| Role | Email | Password |
|------|-------|----------|
| Super Admin | admin@saas.com | admin123 |
| Principal | principal@school.com | principal123 |
| Teacher | teacher@school.com | teacher123 |
| Accountant | accountant@school.com | acc123 |
| Student | student@school.com | student123 |

---

## Project Structure

```
school-backend/
├── server.js
├── package.json
├── .env.example
├── config/
│   ├── db.js
│   └── schema.sql
├── controllers/
│   ├── authController.js
│   ├── studentController.js
│   ├── feeController.js
│   ├── attendanceController.js
│   ├── marksController.js
│   ├── homeworkController.js
│   ├── classController.js
│   ├── userController.js
│   ├── schoolController.js
│   ├── smsController.js
│   └── settingsController.js
├── middleware/
│   ├── auth.js
│   ├── errorHandler.js
│   └── validate.js
├── routes/
│   ├── auth.js / students.js / fees.js / attendance.js / marks.js
│   ├── homework.js / classes.js / users.js / schools.js
│   └── settings.js / sms.js
├── models/            (reserved for future ORM models)
├── uploads/           (static file storage)
├── logs/              (winston log files)
└── utils/
    ├── logger.js
    ├── dbSetup.js
    └── seedData.js
```

---

## Role-Based Access Control

```
admin       → Full access to all schools, global analytics, settings
principal   → All data in their school, read-only analytics
teacher     → Students, marks, attendance, homework for their class
accountant  → Fee management, payment records, receipts
student     → Own profile, marks, attendance, fee status, ID card
```

---

## API Reference (Base: `/api`)

All protected routes require `Authorization: Bearer <accessToken>`.

### Auth
| Method | Endpoint | Description |
|---|---|---|
| POST | /auth/login | Login |
| POST | /auth/refresh | Refresh access token |
| POST | /auth/logout | Logout |
| GET | /auth/me | Current user |
| PUT | /auth/change-password | Change password |

### Students
| Method | Endpoint | Description |
|---|---|---|
| GET | /students | List (filters: class_id, search, status) |
| POST | /students | Add student |
| GET | /students/:id | Details + marks + fees |
| PUT | /students/:id | Update |
| DELETE | /students/:id | Deactivate |
| GET | /students/:id/idcard | ID card data |

### Fees
| Method | Endpoint | Description |
|---|---|---|
| GET | /fees/summary | Dashboard stats |
| GET | /fees/students | Per-student fee status |
| POST | /fees/payment | Record payment |
| GET | /fees/receipt/:receiptNo | Receipt lookup |
| GET | /fees/student/:studentId/payments | Payment history |
| GET | /fees/structures | List fee structures |
| POST | /fees/structures | Create fee structure |
| GET | /fees/monthly-report | Monthly collection |

### Attendance
| Method | Endpoint | Description |
|---|---|---|
| GET | /attendance | Records (filters) |
| POST | /attendance/mark | Bulk mark for class |
| PUT | /attendance/:id | Update record |
| GET | /attendance/summary | Per-student % |
| GET | /attendance/report/class | Class-wise daily |
| GET | /attendance/student/:id | Student history |

### Marks
| Method | Endpoint | Description |
|---|---|---|
| GET | /marks | List (filters) |
| POST | /marks/bulk | Bulk entry |
| GET | /marks/student/:id | Result card |
| GET | /marks/analytics/class | Toppers + averages |

### Homework
| Method | Endpoint | Description |
|---|---|---|
| GET | /homework | List |
| POST | /homework | Assign |
| PUT | /homework/:id | Update |
| DELETE | /homework/:id | Delete |

### Classes
| Method | Endpoint | Description |
|---|---|---|
| GET | /classes | List with counts |
| POST | /classes | Create |
| GET /PUT /DELETE | /classes/:id | Manage |
| GET /POST | /classes/:id/subjects | Manage subjects |

### Users
| Method | Endpoint | Description |
|---|---|---|
| GET | /users | List |
| POST | /users | Create |
| GET /PUT | /users/:id | Manage |
| DELETE | /users/:id | Deactivate |
| PUT | /users/:id/reset-password | Reset password |

### Schools (Super Admin)
| Method | Endpoint | Description |
|---|---|---|
| GET | /schools | List all |
| POST | /schools | Register school |
| GET /PUT /DELETE | /schools/:id | Manage |
| GET | /schools/analytics/global | Global dashboard |

### SMS
| Method | Endpoint | Description |
|---|---|---|
| POST | /sms/send | Send to class/pending/individual |
| GET | /sms/logs | History |

### Settings & Plans
| Method | Endpoint | Description |
|---|---|---|
| GET | /settings/plans | Public plan list |
| POST /PUT | /settings/plans(/:id) | Manage plans (admin) |
| GET /PUT | /settings | Platform settings (admin) |
| GET | /settings/backup | Backup status |

---

## Standard Response Format

```json
// Success
{ "success": true, "data": { ... }, "message": "Optional" }

// Error
{ "success": false, "message": "Error description" }

// Paginated
{ "success": true, "data": [...], "pagination": { "total": 120, "page": 1, "limit": 50, "pages": 3 } }
```

---

## Production Checklist

- [ ] `NODE_ENV=production`
- [ ] Strong random `JWT_SECRET` / `JWT_REFRESH_SECRET` (32+ chars)
- [ ] Dedicated MySQL user (not root)
- [ ] HTTPS / SSL termination
- [ ] Correct `FRONTEND_URL` for CORS
- [ ] PM2 or similar process manager
- [ ] Nginx reverse proxy
- [ ] Automated MySQL backups
- [ ] Real SMS gateway integration (`controllers/smsController.js`)
- [ ] Log rotation
- [ ] Firewall: only 80/443 exposed

```bash
npm install -g pm2
pm2 start server.js --name "edumanage-api" --instances max
pm2 save && pm2 startup
```
