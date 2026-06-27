const router = require("express").Router();
const { login, refreshToken, logout, getMe, changePassword } = require("../controllers/authController");
const { authenticate } = require("../middleware/auth");

router.post("/login", login);
router.post("/refresh", refreshToken);
router.post("/logout", authenticate, logout);
router.get("/me", authenticate, getMe);
router.put("/change-password", authenticate, changePassword);

module.exports = router;
