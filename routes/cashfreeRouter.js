import express from "express";
import {
  createCashfreeOrder,
  verifyCashfreePayment,
  getCashfreeOrderStatus,
  cashfreeWebhook,
  cashfreeCallback,
} from "../controllers/cashfreeController.js";
import { isAuthenticated } from "../middlewares/auth.js";

const router = express.Router();

// Create payment order (requires authentication)
router.post("/create-order", isAuthenticated, createCashfreeOrder);

// Verify payment (requires authentication)
router.post("/verify", isAuthenticated, verifyCashfreePayment);

// Get order status (requires authentication)
router.get("/status/:orderId", isAuthenticated, getCashfreeOrderStatus);

// Webhook handler (no auth - called by Cashfree servers)
router.post("/webhook", cashfreeWebhook);

// Callback URL (no auth - redirect from payment page)
router.get("/callback", cashfreeCallback);

export default router;
