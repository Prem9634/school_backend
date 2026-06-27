const router = require("express").Router();
const ctrl = require("../controllers/marksController");
const { authenticate, authorize, schoolScope } = require("../middleware/auth");

router.use(authenticate, schoolScope);

router.get("/",                    authorize("admin","principal","teacher"),    ctrl.getMarks);
router.post("/bulk",               authorize("admin","teacher"),                ctrl.bulkEnterMarks);
router.get("/analytics/class",     authorize("admin","principal","teacher"),    ctrl.getClassAnalytics);
router.get("/student/:studentId",                                               ctrl.getStudentResult);

module.exports = router;
