import express from "express";
import { isAuthenticated, isAdminAuthenticated } from "../middlewares/auth.js";
import { validateQuantity } from "../middlewares/quantityValidator.js";
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
// Quantity validation middleware ensures role-based rules are enforced
router.get("/cart", isAuthenticated, getCart);
router.post("/cart/add", isAuthenticated, addToCart); // Validation in controller
router.delete("/cart/remove", isAuthenticated, removeFromCart);
router.put("/cart/update", isAuthenticated, updateCartQuantity); // Validation in controller
router.delete("/cart/clear", isAuthenticated, clearCart);

// ==================== ORDER ROUTES ====================
// validateQuantity middleware ensures:
// - Customers: any quantity >= 1
// - Retailers: quantity must be multiple of pack size (b2bMinQty)
router.post("/place", isAuthenticated, validateQuantity, placeOrder);
router.get("/my", isAuthenticated, getOrders);
router.put("/:orderId/cancel", isAuthenticated, cancelOrder);

// ==================== ORDER TRACKING ====================
router.get("/status", isAuthenticated, getOrderStatus);

// ==================== ADMIN ROUTES ====================
router.put("/update-status/:orderId", isAdminAuthenticated, updateOrderStatus);
router.get("/admin/all", isAdminAuthenticated, getAllOrdersAdmin);

// ==================== DETAILS ====================
router.get("/:orderId", isAuthenticated, getOrderById);

export default router;
