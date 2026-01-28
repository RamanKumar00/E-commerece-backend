import express from "express";
import { getDashboardStats } from "../controllers/analyticsController.js";
import { isAuthenticated, isAdminAuthenticated } from "../middlewares/auth.js";

const router = express.Router();

router.get("/dashboard", isAuthenticated, isAdminAuthenticated, getDashboardStats);

export default router;
