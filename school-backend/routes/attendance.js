const { Router } = require("express");
const attendanceCtrl = require("../controllers/attendanceController");
const { authenticate, authorize, schoolScope } = require("../middleware/auth");

const attendanceRouter = Router();
attendanceRouter.use(authenticate, schoolScope);

attendanceRouter.get("/",                   authorize("admin","principal","teacher","accountant"), attendanceCtrl.getAttendance);
attendanceRouter.post("/mark",              authorize("admin","teacher"),                           attendanceCtrl.markAttendance);
attendanceRouter.put("/:id",               authorize("admin","teacher"),                           attendanceCtrl.updateAttendance);
attendanceRouter.get("/summary",            authorize("admin","principal","teacher"),               attendanceCtrl.getAttendanceSummary);
attendanceRouter.get("/report/class",       authorize("admin","principal"),                         attendanceCtrl.getClassReport);
attendanceRouter.get("/student/:studentId",                                                         attendanceCtrl.getStudentAttendance);

module.exports = { attendanceRouter };
