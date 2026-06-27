const router = require("express").Router();
const ctrl = require("../controllers/schoolController");
const { authenticate, authorize } = require("../middleware/auth");

router.use(authenticate, authorize("admin"));

router.get("/analytics/global",  ctrl.getGlobalAnalytics);
router.get("/",                  ctrl.getSchools);
router.post("/",                 ctrl.createSchool);
router.get("/:id",               ctrl.getSchool);
router.put("/:id",               ctrl.updateSchool);
router.delete("/:id",            ctrl.deleteSchool);

module.exports = router;
