const router = require("express").Router();
const ctrl = require("../controllers/settingsController");
const { authenticate, authorize } = require("../middleware/auth");

router.get("/plans",          ctrl.getPlans);
router.post("/plans",         authenticate, authorize("admin"), ctrl.createPlan);
router.put("/plans/:id",      authenticate, authorize("admin"), ctrl.updatePlan);

router.get("/",               authenticate, authorize("admin"), ctrl.getSettings);
router.put("/",               authenticate, authorize("admin"), ctrl.updateSettings);
router.get("/backup",         authenticate, authorize("admin"), ctrl.getBackupStatus);

module.exports = router;
