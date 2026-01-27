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
  getActiveOrders,
  getAllOrdersAdmin,
} from "../controllers/orderController.js";

const app = express.Router();

// ==================== CART ROUTES ====================
// route - /api/v1/order/cart
app.get("/cart", isAuthenticated, getCart);

// route - /api/v1/order/cart/add
app.post("/cart/add", isAuthenticated, addToCart);

// route - /api/v1/order/cart/remove
app.delete("/cart/remove", isAuthenticated, removeFromCart);

// route - /api/v1/order/cart/update
app.put("/cart/update", isAuthenticated, updateCartQuantity);

// route - /api/v1/order/cart/clear
app.delete("/cart/clear", isAuthenticated, clearCart);

// ==================== ORDER ROUTES ====================
// route - /api/v1/order/place
app.post("/place", isAuthenticated, placeOrder);

// route - /api/v1/order/my-orders
app.get("/my-orders", isAuthenticated, getOrders);

// route - /api/v1/order/cancel/:orderId
app.put("/cancel/:orderId", isAuthenticated, cancelOrder);

// ==================== ORDER TRACKING (HTTP POLLING) ====================
// route - /api/v1/order/status?orderId=xxx (Lightweight polling endpoint)
app.get("/status", isAuthenticated, getOrderStatus);

// route - /api/v1/order/active-orders (Get orders that need polling)
app.get("/active-orders", isAuthenticated, getActiveOrders);

// route - /api/v1/order/update-status/:orderId (Admin updates status)
app.put("/update-status/:orderId", isAdminAuthenticated, updateOrderStatus);

// route - /api/v1/order/admin/all-orders (Admin gets ALL orders)
app.get("/admin/all-orders", isAdminAuthenticated, getAllOrdersAdmin);

// route - /api/v1/order/:orderId (Keep at end - catches remaining patterns)
app.get("/:orderId", isAuthenticated, getOrderById);

export default app;
