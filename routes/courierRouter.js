import express from "express";
import { isAuthenticated, authorizeAdmin } from "../middlewares/auth.js";
import {
  checkServiceability,
  getRates,
  getRecommendedCourier,
  createShipment,
  trackShipment,
  getTrackingHistory,
  trackByOrderId,
  cancelShipment,
  handleWebhook,
  getCourierPartners,
  getPerformanceStats,
  getShipments,
} from "../controllers/courierController.js";

const router = express.Router();

// ==================== PUBLIC / CUSTOMER ROUTES ====================

// Track shipment (public - can be accessed by customers)
router.get("/track/:awb", trackShipment);
router.get("/track/order/:orderId", isAuthenticated, trackByOrderId);
router.get("/track/:awb/history", getTrackingHistory);

// ==================== ADMIN ROUTES ====================

// Serviceability
router.post("/check-service", isAuthenticated, authorizeAdmin, checkServiceability);

// Rates
router.get("/rates", isAuthenticated, authorizeAdmin, getRates);
router.post("/recommend", isAuthenticated, authorizeAdmin, getRecommendedCourier);

// Shipment Management
router.post("/create-shipment", isAuthenticated, authorizeAdmin, createShipment);
router.post("/cancel", isAuthenticated, authorizeAdmin, cancelShipment);

// Courier Management
router.get("/partners", isAuthenticated, authorizeAdmin, getCourierPartners);
router.get("/performance", isAuthenticated, authorizeAdmin, getPerformanceStats);
router.get("/shipments", isAuthenticated, authorizeAdmin, getShipments);

// ==================== WEBHOOK ROUTES ====================

// Webhook endpoint - no auth (validated by signature)
router.post("/webhook/:courierName", handleWebhook);

export default router;
