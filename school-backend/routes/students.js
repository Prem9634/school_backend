const router = require("express").Router();
const ctrl = require("../controllers/studentController");
const { authenticate, authorize, schoolScope } = require("../middleware/auth");

router.use(authenticate, schoolScope);

router.get("/",          authorize("admin","principal","teacher","accountant"), ctrl.getStudents);
router.post("/",         authorize("admin","principal","teacher"),              ctrl.createStudent);
router.get("/:id/idcard",                                                       ctrl.getIdCard);
router.get("/:id",       authorize("admin","principal","teacher","accountant","student"), ctrl.getStudent);
router.put("/:id",       authorize("admin","principal","teacher"),              ctrl.updateStudent);
router.delete("/:id",    authorize("admin","principal"),                        ctrl.deleteStudent);

module.exports = router;
