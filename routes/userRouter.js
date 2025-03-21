import express from "express";
import {
  adminRegister,
  getUserDetails,
  login,
  logout,
} from "../controllers/userController.js";
import {  isAuthenticated } from "../middlewares/auth.js";
const app = express.Router();

// route - /api/v1/user/register
app.post("/register", adminRegister);

// route - /api/v1/user/login
app.post("/login", login);

// route - /api/v1/user/login
app.get("/logout", isAuthenticated, logout);

// route - /api/v1/user/details/me
// app.get("/details/me", isAdminAuthenticated, getUserDetails);
app.get("/details/me", isAuthenticated, getUserDetails);

export default app;