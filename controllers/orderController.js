import { catchAsyncErrors } from "../middlewares/catchAsyncErrors.js";
import { User } from "../models/userSchema.js";
import { Product } from "../models/productSchema.js";
import ErrorHandler from "../middlewares/error.js";
import { sendEmail } from "../utils/sendEmail.js";

// ==================== CART CONTROLLERS ====================

// Get user's cart
export const getCart = catchAsyncErrors(async (req, res, next) => {
  const user = await User.findById(req.user._id);
  
  // Populate product details for each cart item
  const cartWithProducts = await Promise.all(
    user.cartProducts.map(async (item) => {
      const product = await Product.findById(item.productId);
      return {
        productId: item.productId,
        quantity: item.quantity,
        product: product || null,
      };
    })
  );

  res.status(200).json({
    success: true,
    cart: cartWithProducts.filter(item => item.product !== null),
  });
});

// Add item to cart
export const addToCart = catchAsyncErrors(async (req, res, next) => {
  const { productId, quantity = 1 } = req.body;

  if (!productId) {
    return next(new ErrorHandler("Product ID is required!", 400));
  }

  // Check if product exists
  const product = await Product.findById(productId);
  if (!product) {
    return next(new ErrorHandler("Product not found!", 404));
  }

  const user = await User.findById(req.user._id);
  
  // Check if product already in cart
  const existingItemIndex = user.cartProducts.findIndex(
    (item) => item.productId === productId
  );

  if (existingItemIndex >= 0) {
    // Update quantity
    user.cartProducts[existingItemIndex].quantity += quantity;
  } else {
    // Add new item
    user.cartProducts.push({ productId, quantity });
  }

  await user.save();

  res.status(200).json({
    success: true,
    message: "Product added to cart",
    cart: user.cartProducts,
  });
});

// Remove item from cart
export const removeFromCart = catchAsyncErrors(async (req, res, next) => {
  const { productId } = req.body;

  if (!productId) {
    return next(new ErrorHandler("Product ID is required!", 400));
  }

  const user = await User.findById(req.user._id);
  
  user.cartProducts = user.cartProducts.filter(
    (item) => item.productId !== productId
  );

  await user.save();

  res.status(200).json({
    success: true,
    message: "Product removed from cart",
    cart: user.cartProducts,
  });
});

// Update cart item quantity
export const updateCartQuantity = catchAsyncErrors(async (req, res, next) => {
  const { productId, quantity } = req.body;

  if (!productId || quantity === undefined) {
    return next(new ErrorHandler("Product ID and quantity are required!", 400));
  }

  if (quantity <= 0) {
    return next(new ErrorHandler("Quantity must be greater than 0!", 400));
  }

  const user = await User.findById(req.user._id);
  
  const itemIndex = user.cartProducts.findIndex(
    (item) => item.productId === productId
  );

  if (itemIndex < 0) {
    return next(new ErrorHandler("Product not found in cart!", 404));
  }

  user.cartProducts[itemIndex].quantity = quantity;
  await user.save();

  res.status(200).json({
    success: true,
    message: "Cart updated",
    cart: user.cartProducts,
  });
});

// Clear entire cart
export const clearCart = catchAsyncErrors(async (req, res, next) => {
  const user = await User.findById(req.user._id);
  user.cartProducts = [];
  await user.save();

  res.status(200).json({
    success: true,
    message: "Cart cleared",
  });
});

// ==================== ORDER CONTROLLERS ====================

// Place a new order
export const placeOrder = catchAsyncErrors(async (req, res, next) => {
  const { products, deliveryAddress, paymentMethod } = req.body;

  if (!products || products.length === 0) {
    return next(new ErrorHandler("No products to order!", 400));
  }

  // 1. Validate Stock
  for (const item of products) {
    const product = await Product.findById(item.productId);
    if (!product) {
      return next(new ErrorHandler(`Product not found: ${item.productId}`, 404));
    }
    if (product.stock < item.quantity) {
      return next(new ErrorHandler(`Insufficient stock for ${product.productName}`, 400));
    }
  }

  const user = await User.findById(req.user._id);

  // 2. Decorate items and Deduct Stock
  const orderItems = [];
  const lowStockThreshold = 5;

  for (const item of products) {
    const product = await Product.findById(item.productId);
    
    // Deduct stock
    product.stock -= item.quantity;
    await product.save();
    
    // Low Stock Alert
    if (product.stock < lowStockThreshold) {
       // Send async email (don't await to avoid delay)
       sendEmail(
         process.env.SMTP_EMAIL, 
         "⚠️ Low Stock Alert - Aman Enterprises",
         `Product "${product.productName}" is running low on stock. Current Quantity: ${product.stock}`
       ).catch(err => console.error("Alert Email Failed:", err));
    }
    
    orderItems.push({
      productId: item.productId,
      quantity: item.quantity.toString(),
      status: "Placed",
      cancelledByUser: false,
      cancelledByAdmin: false,
    });
  }

  // Add to user's orders
  user.orders.push(...orderItems);
  
  // Clear cart after placing order
  user.cartProducts = [];
  
  await user.save();
  
  // Order Confirmation Email
  sendEmail(
      user.email,
      "Order Placed - Aman Enterprises",
      `Your order for ${orderItems.length} items has been placed successfully!`
  ).catch(console.error);

  res.status(200).json({
    success: true,
    message: "Order placed successfully!",
    orders: orderItems,
  });
});

// Get all orders for user
export const getOrders = catchAsyncErrors(async (req, res, next) => {
  const user = await User.findById(req.user._id);

  // Populate product details for each order
  const ordersWithProducts = await Promise.all(
    user.orders.map(async (order) => {
      const product = await Product.findById(order.productId);
      return {
        orderId: order._id,
        productId: order.productId,
        quantity: order.quantity,
        status: order.status,
        cancelledByUser: order.cancelledByUser,
        cancelledByAdmin: order.cancelledByAdmin,
        product: product || null,
      };
    })
  );

  res.status(200).json({
    success: true,
    orders: ordersWithProducts.filter(order => order.product !== null),
  });
});

// Get single order by ID
export const getOrderById = catchAsyncErrors(async (req, res, next) => {
  const { orderId } = req.params;
  
  const user = await User.findById(req.user._id);
  const order = user.orders.id(orderId);

  if (!order) {
    return next(new ErrorHandler("Order not found!", 404));
  }

  const product = await Product.findById(order.productId);

  res.status(200).json({
    success: true,
    order: {
      ...order.toObject(),
      product,
    },
  });
});

// Cancel an order
export const cancelOrder = catchAsyncErrors(async (req, res, next) => {
  const { orderId } = req.params;
  
  const user = await User.findById(req.user._id);
  const order = user.orders.id(orderId);

  if (!order) {
    return next(new ErrorHandler("Order not found!", 404));
  }

  if (order.status === "Delivered") {
    return next(new ErrorHandler("Cannot cancel delivered order!", 400));
  }

  if (order.cancelledByUser || order.cancelledByAdmin) {
    return next(new ErrorHandler("Order is already cancelled!", 400));
  }

  order.cancelledByUser = true;
  order.status = "Cancelled";
  
  await user.save();

  res.status(200).json({
    success: true,
    message: "Order cancelled successfully",
  });
});

// ==================== ORDER TRACKING (HTTP POLLING) ====================

/**
 * GET /order/status?orderId=xxx
 * Lightweight endpoint for polling - returns only status info
 * Frontend should poll every 5-10 seconds for active orders
 */
export const getOrderStatus = catchAsyncErrors(async (req, res, next) => {
  const { orderId } = req.query;

  if (!orderId) {
    return next(new ErrorHandler("Order ID is required!", 400));
  }

  const user = await User.findById(req.user._id);
  const order = user.orders.id(orderId);

  if (!order) {
    return next(new ErrorHandler("Order not found!", 404));
  }

  // Return minimal data for efficient polling
  res.status(200).json({
    success: true,
    orderId: order._id,
    status: order.status,
    statusCode: getStatusCode(order.status),
    isCancelled: order.cancelledByUser || order.cancelledByAdmin,
    isDelivered: order.status === "Delivered",
    updatedAt: order.updatedAt || new Date(),
  });
});

/**
 * PUT /order/update-status/:orderId (Admin only)
 * Update order status - triggers change that polling will detect
 */
export const updateOrderStatus = catchAsyncErrors(async (req, res, next) => {
  const { orderId } = req.params;
  const { status } = req.body;

  const validStatuses = ["Placed", "Confirmed", "Packed", "Out for Delivery", "Delivered"];
  
  if (!status || !validStatuses.includes(status)) {
    return next(new ErrorHandler(`Invalid status! Must be one of: ${validStatuses.join(", ")}`, 400));
  }

  // Find user with this order
  const user = await User.findOne({ "orders._id": orderId });
  
  if (!user) {
    return next(new ErrorHandler("Order not found!", 404));
  }

  const order = user.orders.id(orderId);
  
  if (order.cancelledByUser || order.cancelledByAdmin) {
    return next(new ErrorHandler("Cannot update cancelled order!", 400));
  }

  order.status = status;
  order.updatedAt = new Date();
  
  await user.save();

  // Order Status Email
  if (["Out for Delivery", "Delivered"].includes(status)) {
     sendEmail(
       user.email,
       `Order Update: ${status}`,
       `Your order ${order._id} is now ${status}. Thank you for shopping with Aman Enterprises!`
     ).catch(console.error);
  }

  res.status(200).json({
    success: true,
    message: `Order status updated to: ${status}`,
    order: {
      orderId: order._id,
      status: order.status,
      statusCode: getStatusCode(status),
    },
  });
});

/**
 * GET /order/active-orders
 * Get all active (non-delivered) orders for a user
 * Frontend uses this to know which orders to poll
 */
export const getActiveOrders = catchAsyncErrors(async (req, res, next) => {
  const user = await User.findById(req.user._id);

  const activeOrders = user.orders.filter(
    (order) => 
      order.status !== "Delivered" && 
      !order.cancelledByUser && 
      !order.cancelledByAdmin
  );

  const ordersWithProducts = await Promise.all(
    activeOrders.map(async (order) => {
      const product = await Product.findById(order.productId);
      return {
        orderId: order._id,
        productId: order.productId,
        status: order.status,
        statusCode: getStatusCode(order.status),
        product: product ? {
          name: product.productName,
          image: product.image?.url,
          price: product.price,
        } : null,
      };
    })
  );

  res.status(200).json({
    success: true,
    activeOrders: ordersWithProducts,
    count: ordersWithProducts.length,
  });
});

// Helper function to convert status to numeric code for easy comparison
function getStatusCode(status) {
  const statusMap = {
    "Placed": 1,
    "Confirmed": 2,
    "Packed": 3,
    "Out for Delivery": 4,
    "Delivered": 5,
    "Cancelled": 0,
  };
  return statusMap[status] || 0;
}

// Get ALL orders (Admin only)
export const getAllOrdersAdmin = catchAsyncErrors(async (req, res, next) => {
  const users = await User.find();
  let allOrders = [];

  // Extract orders from all users
  for (const user of users) {
    if (user.orders && user.orders.length > 0) {
      for (const order of user.orders) {
        allOrders.push({
          ...order.toObject(),
          userDetails: {
            id: user._id,
            name: user.shopName || "Unknown",
            phone: user.phone,
            address: user.address,
            city: user.city,
            pincode: user.pincode,
          },
        });
      }
    }
  }

  // Populate product details
  const populatedOrders = await Promise.all(
    allOrders.map(async (order) => {
      const product = await Product.findById(order.productId);
      return {
        ...order,
        product: product
          ? {
              name: product.productName,
              image: product.image?.url,
              price: product.price,
              category: product.category,
            }
          : null,
      };
    })
  );
  
  // Sort by date (newest first)
  populatedOrders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  res.status(200).json({
    success: true,
    orders: populatedOrders,
    count: populatedOrders.length,
  });
});

