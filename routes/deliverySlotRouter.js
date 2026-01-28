import express from "express";
import { getDeliverySlots, createDeliverySlots } from "../controllers/deliverySlotController.js";
import { isAuthenticated, isAdminAuthenticated } from "../middlewares/auth.js";

const router = express.Router();

router.get("/available", isAuthenticated, getDeliverySlots);
router.post("/create", isAuthenticated, isAdminAuthenticated, createDeliverySlots);

export default router;
