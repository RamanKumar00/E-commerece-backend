import { catchAsyncErrors } from "../middlewares/catchAsyncErrors.js";
import { User } from "../models/userSchema.js";
import { Product } from "../models/productSchema.js";
import { Order } from "../models/orderSchema.js"; // New Schema
import { Coupon } from "../models/couponSchema.js"; // New Schema
import ErrorHandler from "../middlewares/error.js";
import { sendEmail } from "../utils/sendEmail.js";

// ==================== ORDER CONTROLLERS ====================

// Place a new order
export const placeOrder = catchAsyncErrors(async (req, res, next) => {
  const { 
    products, 
    deliveryAddress, 
    paymentMethod, 
    couponCode, 
    deliverySlot 
  } = req.body;

  if (!products || products.length === 0) {
    return next(new ErrorHandler("No products to order!", 400));
  }

  if (!deliveryAddress) {
    return next(new ErrorHandler("Delivery address is required!", 400));
  }

  // 1. Validate Stock & Calculate Prices
  let orderItems = [];
  let itemsPrice = 0;

  for (const item of products) {
    const product = await Product.findById(item.productId);
    if (!product) {
      return next(new ErrorHandler(`Product not found: ${item.productId}`, 404));
    }
    if (product.stock < item.quantity) {
      return next(new ErrorHandler(`Insufficient stock for ${product.productName}`, 400));
    }

    const isRetailer = req.user.role === "RetailUser";
    
    // B2B Validation
    if (isRetailer) {
       if (product.isB2BAvailable === false) {
          return next(new ErrorHandler(`Product "${product.productName}" is not available for B2B orders.`, 400));
       }
       
       const packSize = product.b2bMinQty || 6;
       if (item.quantity < packSize) {
          return next(new ErrorHandler(`Minimum order quantity for "${product.productName}" is ${packSize} units.`, 400));
       }
       
       if (item.quantity % packSize !== 0) {
          return next(new ErrorHandler(`Quantity for "${product.productName}" must be a multiple of pack size (${packSize}).`, 400));
       }
    }

    const price = (isRetailer && product.b2bPrice) ? product.b2bPrice : product.price; // Use B2B price if applicable
    const totalItemPrice = price * item.quantity;
    itemsPrice += totalItemPrice;

    orderItems.push({
      product: product._id,
      name: product.productName,
      quantity: item.quantity,
      price: price, // Snapshot price at time of order
      image: product.image?.url || ""
    });
  }

  // 2. Apply Coupon
  let discountAmount = 0;
  let couponId = null;

  if (couponCode) {
    const coupon = await Coupon.findOne({ code: couponCode.toUpperCase(), isActive: true });
    
    if (coupon) {
      if (new Date() > coupon.expiryDate) {
        return next(new ErrorHandler("Coupon has expired", 400));
      }
      if (coupon.usedCount >= coupon.usageLimit) {
        return next(new ErrorHandler("Coupon usage limit exceeded", 400));
      }
      if (itemsPrice < coupon.minOrderValue) {
        return next(new ErrorHandler(`Coupon requires minimum order of ₹${coupon.minOrderValue}`, 400));
      }

      // Calculate Discount
      if (coupon.discountType === "Flat") {
        discountAmount = coupon.discountValue;
      } else {
        discountAmount = (itemsPrice * coupon.discountValue) / 100;
        if (coupon.maxDiscountAmount) {
          discountAmount = Math.min(discountAmount, coupon.maxDiscountAmount);
        }
      }

      couponId = coupon._id;
      
      // Update Coupon Usage
      coupon.usedCount += 1;
      await coupon.save();
    }
  }

  // 3. Final Calculations
  const shippingPrice = itemsPrice > 500 ? 0 : 40; // Example rule: Free shipping over 500
  const taxPrice = itemsPrice * 0.05; // 5% Tax
  const totalPrice = itemsPrice + shippingPrice + taxPrice - discountAmount;

  // 4. Create Order
  const order = await Order.create({
    user: req.user._id,
    shippingAddress: {
      details: deliveryAddress.details || deliveryAddress.address, // Handle different field names
      city: deliveryAddress.city,
      state: deliveryAddress.state,
      pincode: deliveryAddress.pincode,
      phone: deliveryAddress.phone || req.user.phone
    },
    orderItems,
    paymentInfo: {
      method: paymentMethod || "COD",
      status: paymentMethod === "Online" ? "Paid" : "Pending" // Simplified
    },
    coupon: couponId,
    pricing: {
      itemsPrice,
      taxPrice,
      shippingPrice,
      discountAmount,
      totalPrice
    },
    deliverySlot: deliverySlot ? {
      date: new Date(deliverySlot.date),
      timeSlot: deliverySlot.timeSlot
    } : undefined,
    orderType: req.user.role === "RetailUser" ? "B2B" : "B2C"
  });

  // 5. Update Stock
  const lowStockThreshold = 5;
  for (const item of orderItems) {
    const product = await Product.findById(item.product);
    product.stock -= item.quantity;
    await product.save();

    // Low Stock Alert
    if (product.stock < lowStockThreshold) {
       sendEmail(
         process.env.SMTP_EMAIL, 
         "⚠️ Low Stock Alert - Aman Enterprises",
         `Product "${product.productName}" is running low on stock. Current Quantity: ${product.stock}`
       ).catch(err => console.error("Alert Email Failed:", err));
    }
  }

  // 6. Update User's Order History (Ref)
  const user = await User.findById(req.user._id);
  user.orders.push(order._id); // Assuming we change User schema to hold refs
  // Clear cart
  user.cartProducts = []; 
  await user.save();

  // 7. Send Confirmation Email
  sendEmail(
      user.email,
      "Order Confirmation - Aman Enterprises",
      `Your order #${order.trackingId} has been placed! Total: ₹${totalPrice.toFixed(2)}`
  ).catch(console.error);

  res.status(201).json({
    success: true,
    message: "Order placed successfully!",
    order
  });
});

// Get My Orders
export const getOrders = catchAsyncErrors(async (req, res, next) => {
  const orders = await Order.find({ user: req.user._id })
                            .sort({ createdAt: -1 });

  res.status(200).json({
    success: true,
    orders,
  });
});

// Get Single Order Details
export const getOrderById = catchAsyncErrors(async (req, res, next) => {
  const { orderId } = req.params; // Expects Order ID (the Mongo _id) or Tracking ID? Let's use _id for now.
  
  // Try to find by _id
  let order;
  if (orderId.match(/^[0-9a-fA-F]{24}$/)) {
    order = await Order.findById(orderId).populate("user", "name email phone");
  } else {
    // Try trackingID
    order = await Order.findOne({ trackingId: orderId }).populate("user", "name email phone");
  }

  if (!order) {
    return next(new ErrorHandler("Order not found!", 404));
  }

  // Ensure user owns this order (unless Admin)
  if (req.user.role !== "Admin" && order.user._id.toString() !== req.user._id.toString()) {
    return next(new ErrorHandler("Unauthorized to view this order", 403));
  }

  res.status(200).json({
    success: true,
    order,
  });
});

// Get Order Status (Fast Polling)
export const getOrderStatus = catchAsyncErrors(async (req, res, next) => {
  const { orderId } = req.query;
  
  const order = await Order.findById(orderId);
  if (!order) {
    return next(new ErrorHandler("Order not found", 404));
  }

  res.status(200).json({
    success: true,
    trackingId: order.trackingId,
    status: order.orderStatus,
    deliverySlot: order.deliverySlot
  });
});

// Get All Orders (Admin)
export const getAllOrdersAdmin = catchAsyncErrors(async (req, res, next) => {
  const orders = await Order.find()
                          .populate("user", "name email phone shopName")
                          .sort({ createdAt: -1 });

  res.status(200).json({
    success: true,
    orders,
    count: orders.length
  });
});

// Update Order Status (Admin)
export const updateOrderStatus = catchAsyncErrors(async (req, res, next) => {
  const { orderId } = req.params;
  const { status } = req.body;

  const order = await Order.findById(orderId);
  if (!order) {
    return next(new ErrorHandler("Order not found", 404));
  }

  if (order.orderStatus === "Delivered") {
    return next(new ErrorHandler("Order is already delivered", 400));
  }

  order.orderStatus = status;
  
  if (status === "Delivered") {
    order.deliveredAt = Date.now();
  }
  
  // Add to timeline
  order.timeline.push({
    status: status,
    timestamp: Date.now()
  });

  await order.save();
  
  // Notify User (Email)
  const user = await User.findById(order.user);
  if (user) {
     sendEmail(
       user.email,
       `Order Update: ${status}`,
       `Your order #${order.trackingId} is now ${status}.`
     ).catch(console.error);
  }

  res.status(200).json({
    success: true,
    message: "Order status updated",
    order
  });
});

// Cancel Order (User)
export const cancelOrder = catchAsyncErrors(async (req, res, next) => {
  const { orderId } = req.params;
  const order = await Order.findById(orderId);

  if (!order) {
    return next(new ErrorHandler("Order not found", 404));
  }
  
  if (order.user.toString() !== req.user._id.toString()) {
     return next(new ErrorHandler("Unauthorized", 403));
  }

  if (order.orderStatus === "Delivered" || order.orderStatus === "Out for Delivery") {
    return next(new ErrorHandler("Cannot cancel order at this stage", 400));
  }

  order.orderStatus = "Cancelled";
  order.timeline.push({ status: "Cancelled", timestamp: Date.now() });
  
  // Release Stock
  for (const item of order.orderItems) {
    const product = await Product.findById(item.product);
    if (product) {
      product.stock += item.quantity;
      await product.save();
    }
  }

  await order.save();

  res.status(200).json({
    success: true,
    message: "Order cancelled successfully"
  });
});

// Cart controllers remain the same (exported from the same file or should be separated, 
// for now we will keep them if they were in the original file, or re-implement/import them)
// Wait, the original file had Cart controllers too. I should preserve them.
// I will copy the Cart controllers from the original file content I read earlier.

// ... [Insert Cart Controllers here] ...
// Helper: I will assume the previous cart controllers are good, I'll just copy them over.

// Get user's cart
export const getCart = catchAsyncErrors(async (req, res, next) => {
  const user = await User.findById(req.user._id);
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

export const addToCart = catchAsyncErrors(async (req, res, next) => {
  const { productId, quantity = 1 } = req.body;
  if (!productId) return next(new ErrorHandler("Product ID is required!", 400));
  const product = await Product.findById(productId);
  if (!product) return next(new ErrorHandler("Product not found!", 404));

  const user = await User.findById(req.user._id);
  const existingItemIndex = user.cartProducts.findIndex((item) => item.productId === productId);
  
  // B2B Validation
  if (user.role === "RetailUser") {
      if (product.isB2BAvailable === false) {
           return next(new ErrorHandler("Product not available for B2B", 400));
      }
      const minQty = product.b2bMinQty || 6;
      const currentQty = existingItemIndex >= 0 ? user.cartProducts[existingItemIndex].quantity : 0;
      const finalQty = currentQty + quantity;

      if (finalQty < minQty) {
          return next(new ErrorHandler(`B2B: Minimum quantity is ${minQty}`, 400));
      }
      if (finalQty % minQty !== 0) {
          return next(new ErrorHandler(`B2B: Quantity must be a multiple of ${minQty}`, 400));
      }
  }

  if (existingItemIndex >= 0) {
    user.cartProducts[existingItemIndex].quantity += quantity;
  } else {
    user.cartProducts.push({ productId, quantity });
  }
  await user.save();
  res.status(200).json({ success: true, message: "Product added to cart", cart: user.cartProducts });
});

export const removeFromCart = catchAsyncErrors(async (req, res, next) => {
  const { productId } = req.body;
  if (!productId) return next(new ErrorHandler("Product ID is required!", 400));
  const user = await User.findById(req.user._id);
  user.cartProducts = user.cartProducts.filter((item) => item.productId !== productId);
  await user.save();
  res.status(200).json({ success: true, message: "Product removed from cart", cart: user.cartProducts });
});

export const updateCartQuantity = catchAsyncErrors(async (req, res, next) => {
  const { productId, quantity } = req.body;
  if (!productId || quantity === undefined) return next(new ErrorHandler("Product ID and quantity are required!", 400));
  if (quantity <= 0) return next(new ErrorHandler("Quantity must be greater than 0!", 400));
  
  const user = await User.findById(req.user._id);
  const itemIndex = user.cartProducts.findIndex((item) => item.productId === productId);
  if (itemIndex < 0) return next(new ErrorHandler("Product not found in cart!", 404));

  // B2B Validation
  if (user.role === "RetailUser") {
      const product = await Product.findById(productId);
      if (product) { // Only check if product exists (it should)
          if (product.isB2BAvailable === false) {
             // Remove item? Or just error? Error for now.
             return next(new ErrorHandler("Product not available for B2B", 400));
          }
          const minQty = product.b2bMinQty || 6;
          if (quantity < minQty) {
              return next(new ErrorHandler(`B2B: Minimum quantity is ${minQty}`, 400));
          }
          if (quantity % minQty !== 0) {
              return next(new ErrorHandler(`B2B: Quantity must be a multiple of ${minQty}`, 400));
          }
      }
  }

  user.cartProducts[itemIndex].quantity = quantity;
  await user.save();
  res.status(200).json({ success: true, message: "Cart updated", cart: user.cartProducts });
});

export const clearCart = catchAsyncErrors(async (req, res, next) => {
  const user = await User.findById(req.user._id);
  user.cartProducts = [];
  await user.save();
  res.status(200).json({ success: true, message: "Cart cleared" });
});
