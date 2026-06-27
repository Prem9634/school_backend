const router = require("express").Router();
const ctrl = require("../controllers/smsController");
const { authenticate, authorize, schoolScope } = require("../middleware/auth");

router.use(authenticate, schoolScope);

router.post("/send",  authorize("admin","principal","teacher"), ctrl.sendSms);
router.get("/logs",   authorize("admin","principal"),           ctrl.getSmsLogs);

module.exports = router;
