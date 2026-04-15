const express = require("express");
const authMiddleware = require("../middleware/auth");
const auth = require("../controllers/authController");

const router = express.Router();

router.post("/register", auth.register);
router.post("/login", auth.login);
router.put("/change-password", authMiddleware, auth.changePassword);
router.post("/forgot-password", auth.forgotPassword);
router.post("/verify-otp", auth.verifyOtp);
router.post("/reset-password", auth.resetPassword);

module.exports = router;
