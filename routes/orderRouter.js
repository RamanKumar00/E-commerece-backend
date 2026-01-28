import express from "express";
import { isAuthenticated, isAdminAuthenticated } from "../middlewares/auth.js";
import {
  addToCart,
  removeFromCart,
  getCart,
  updateCartQuantity,
  clearCart,
  placeOrder,
  getOrders,
  getOrderById,
  cancelOrder,
  getOrderStatus,
  updateOrderStatus,
  getAllOrdersAdmin,
} from "../controllers/orderController.js";

const router = express.Router();

// ==================== CART ROUTES ====================
router.get("/cart", isAuthenticated, getCart);
router.post("/cart/add", isAuthenticated, addToCart);
router.delete("/cart/remove", isAuthenticated, removeFromCart);
router.put("/cart/update", isAuthenticated, updateCartQuantity);
router.delete("/cart/clear", isAuthenticated, clearCart);

// ==================== ORDER ROUTES ====================
router.post("/place", isAuthenticated, placeOrder);
router.get("/my", isAuthenticated, getOrders); // Changed from /my-orders to match Service
router.put("/:orderId/cancel", isAuthenticated, cancelOrder); // Matches /$orderId/cancel

// ==================== ORDER TRACKING ====================
router.get("/status", isAuthenticated, getOrderStatus);
// router.get("/active", isAuthenticated, getActiveOrders); // Commented out unless added to controller

// ==================== ADMIN ROUTES ====================
router.put("/update-status/:orderId", isAdminAuthenticated, updateOrderStatus);
router.get("/admin/all", isAdminAuthenticated, getAllOrdersAdmin); // Changed from /admin/all-orders to be simpler

// ==================== DETAILS ====================
router.get("/:orderId", isAuthenticated, getOrderById);

export default router;
