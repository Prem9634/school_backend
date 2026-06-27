const router = require("express").Router();
const ctrl = require("../controllers/feeController");
const { authenticate, authorize, schoolScope } = require("../middleware/auth");

router.use(authenticate, schoolScope);

router.get("/summary",                  authorize("admin","principal","accountant"),  ctrl.getFeeSummary);
router.get("/students",                 authorize("admin","principal","accountant"),  ctrl.getStudentFees);
router.get("/monthly-report",           authorize("admin","principal","accountant"),  ctrl.getMonthlyReport);
router.post("/payment",                 authorize("admin","accountant"),              ctrl.addPayment);
router.get("/receipt/:receiptNo",       authorize("admin","accountant","principal"),  ctrl.getReceipt);
router.get("/student/:studentId/payments",                                           ctrl.getStudentPayments);
router.get("/structures",               authorize("admin","principal","accountant"),  ctrl.getFeeStructures);
router.post("/structures",              authorize("admin","principal"),               ctrl.createFeeStructure);

module.exports = router;
