const router = require("express").Router();
const ctrl = require("../controllers/userController");
const { authenticate, authorize, schoolScope } = require("../middleware/auth");

router.use(authenticate, schoolScope);

router.get("/",                       authorize("admin","principal"),    ctrl.getUsers);
router.post("/",                      authorize("admin","principal"),    ctrl.createUser);
router.get("/:id",                    authorize("admin","principal"),    ctrl.getUser);
router.put("/:id",                    authorize("admin","principal"),    ctrl.updateUser);
router.delete("/:id",                 authorize("admin"),                ctrl.deleteUser);
router.put("/:id/reset-password",     authorize("admin","principal"),    ctrl.resetPassword);

module.exports = router;
