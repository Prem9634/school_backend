const router = require("express").Router();
const ctrl = require("../controllers/classController");
const { authenticate, authorize, schoolScope } = require("../middleware/auth");

router.use(authenticate, schoolScope);

router.get("/",                    ctrl.getClasses);
router.post("/",                   authorize("admin","principal"), ctrl.createClass);
router.get("/:id",                 ctrl.getClass);
router.put("/:id",                 authorize("admin","principal"), ctrl.updateClass);
router.delete("/:id",              authorize("admin","principal"), ctrl.deleteClass);
router.get("/:id/subjects",        ctrl.getClassSubjects);
router.post("/:id/subjects",       authorize("admin","principal"), ctrl.addSubject);

module.exports = router;
