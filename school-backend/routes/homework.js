const router = require("express").Router();
const ctrl = require("../controllers/homeworkController");
const { authenticate, authorize, schoolScope } = require("../middleware/auth");

router.use(authenticate, schoolScope);

router.get("/",       ctrl.getHomework);
router.post("/",      authorize("admin","principal","teacher"), ctrl.createHomework);
router.put("/:id",    authorize("admin","principal","teacher"), ctrl.updateHomework);
router.delete("/:id", authorize("admin","principal","teacher"), ctrl.deleteHomework);

module.exports = router;
