import express from "express";
import {
  userRegister,
  getUserDetails,
  login,
  sendOTPtoGeneratePassword,
  verifyOtpToGeneratePassword,
  createNewPassword,
  sendOTPtoVerifyEmail,
  verifyOtpToVerifyEmail,
  updateLanguage,
  getAllUsers,
  updateUserRole
} from "../controllers/userController.js";
import { isAuthenticated, isAdminAuthenticated } from "../middlewares/auth.js";
const app = express.Router();

// route - /api/otp-verify-email
app.post("/otp-verify-email", sendOTPtoVerifyEmail);

// route - /api/verify-email
app.post("/verify-email", verifyOtpToVerifyEmail);

// route - /api/v1/user/register
app.post("/register", userRegister);

// route - /api/v1/user/login
app.post("/login", login);

// route - /api/details/me
app.get("/details/me", isAuthenticated, getUserDetails);

// route - /api/otp-generate-password
app.post("/otp-generate-password", sendOTPtoGeneratePassword);

// route - /api/verify-otp-generate-password
app.post("/verify-otp-generate-password", verifyOtpToGeneratePassword);

// route - /api/create-password
app.put("/create-password", createNewPassword);

// route - /api/v1/user/language
app.put("/language", isAuthenticated, updateLanguage);

// Admin Routes
app.get("/admin/all-users", isAuthenticated, isAdminAuthenticated, getAllUsers);
app.put("/admin/update-role/:id", isAuthenticated, isAdminAuthenticated, updateUserRole);

export default app;
