import express from "express";
import { registerDevice, getMyNotifications, markNotificationsRead, broadcastNotification } from "../controllers/notificationController.js";
import { isAuthenticated, isAdminAuthenticated } from "../middlewares/auth.js";

const router = express.Router();

router.post("/device/register", isAuthenticated, registerDevice);
router.get("/my", isAuthenticated, getMyNotifications);
router.put("/read", isAuthenticated, markNotificationsRead);
router.post("/broadcast", isAuthenticated, isAdminAuthenticated, broadcastNotification);

export default router;
