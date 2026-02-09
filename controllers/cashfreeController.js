import { catchAsyncErrors } from "../middlewares/catchAsyncErrors.js";
import ErrorHandler from "../middlewares/error.js";
import crypto from "crypto";
import https from "https";

/**
 * Cashfree Payment Gateway Controller
 * 
 * Environment Variables Required:
 * - CASHFREE_APP_ID: Your Cashfree App ID
 * - CASHFREE_SECRET_KEY: Your Cashfree Secret Key
 * - CASHFREE_ENV: 'sandbox' or 'production'
 */

// Cashfree API Configuration
const CASHFREE_APP_ID = process.env.CASHFREE_APP_ID || "YOUR_APP_ID";
const CASHFREE_SECRET_KEY = process.env.CASHFREE_SECRET_KEY || "YOUR_SECRET_KEY";
const CASHFREE_ENV = process.env.CASHFREE_ENV || "sandbox"; // 'sandbox' or 'production'

// API Base URLs
const API_BASE = CASHFREE_ENV === "production" 
  ? "https://api.cashfree.com/pg" 
  : "https://sandbox.cashfree.com/pg";

const API_VERSION = "2023-08-01"; // Cashfree API version

/**
 * Helper function to make Cashfree API requests
 */
const cashfreeRequest = async (endpoint, method, body = null) => {
  const url = `${API_BASE}${endpoint}`;
  
  const options = {
    method,
    headers: {
      "Content-Type": "application/json",
      "x-client-id": CASHFREE_APP_ID,
      "x-client-secret": CASHFREE_SECRET_KEY,
      "x-api-version": API_VERSION,
    },
  };

  const response = await fetch(url, {
    ...options,
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(data.message || JSON.stringify(data));
  }
  
  return data;
};

/**
 * Create Cashfree Order
 * POST /api/v1/cashfree/create-order
 */
export const createCashfreeOrder = catchAsyncErrors(async (req, res, next) => {
  const { amount, customerName, customerEmail, customerPhone } = req.body;

  if (!amount || amount <= 0) {
    return next(new ErrorHandler("Invalid amount", 400));
  }

  if (!customerPhone) {
    return next(new ErrorHandler("Customer phone is required", 400));
  }

  try {
    // Generate unique order ID
    const orderId = `order_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    // Create order request body
    const orderPayload = {
      order_id: orderId,
      order_amount: parseFloat(amount).toFixed(2),
      order_currency: "INR",
      customer_details: {
        customer_id: req.user._id.toString(),
        customer_name: customerName || req.user.name || "Customer",
        customer_email: customerEmail || req.user.email || "customer@example.com",
        customer_phone: customerPhone.replace(/\D/g, "").slice(-10), // Last 10 digits
      },
      order_meta: {
        return_url: `https://aman-enterprises-api.onrender.com/api/v1/cashfree/callback?order_id=${orderId}`,
        notify_url: `https://aman-enterprises-api.onrender.com/api/v1/cashfree/webhook`,
      },
      order_note: "Aman Enterprises Order",
    };

    // Create order via Cashfree API
    const orderResponse = await cashfreeRequest("/orders", "POST", orderPayload);

    console.log("Cashfree Order Created:", orderResponse.order_id);

    res.status(201).json({
      success: true,
      orderId: orderResponse.order_id,
      paymentSessionId: orderResponse.payment_session_id,
      orderAmount: orderResponse.order_amount,
      orderStatus: orderResponse.order_status,
    });

  } catch (error) {
    console.error("Cashfree Order Creation Error:", error);
    return next(new ErrorHandler(`Payment order creation failed: ${error.message}`, 500));
  }
});

/**
 * Verify Cashfree Payment
 * POST /api/v1/cashfree/verify
 */
export const verifyCashfreePayment = catchAsyncErrors(async (req, res, next) => {
  const { orderId } = req.body;

  if (!orderId) {
    return next(new ErrorHandler("Order ID is required", 400));
  }

  try {
    // Fetch order details from Cashfree
    const orderDetails = await cashfreeRequest(`/orders/${orderId}`, "GET");

    if (orderDetails.order_status === "PAID") {
      // Also fetch payment details
      const payments = await cashfreeRequest(`/orders/${orderId}/payments`, "GET");
      const successPayment = payments.find(p => p.payment_status === "SUCCESS");

      res.status(200).json({
        success: true,
        message: "Payment verified successfully",
        orderId: orderId,
        paymentId: successPayment?.cf_payment_id || orderId,
        paymentStatus: "PAID",
        paymentAmount: orderDetails.order_amount,
        paymentMethod: successPayment?.payment_group || "UNKNOWN",
      });
    } else {
      return next(new ErrorHandler(`Payment not completed. Status: ${orderDetails.order_status}`, 400));
    }

  } catch (error) {
    console.error("Cashfree Verification Error:", error);
    return next(new ErrorHandler(`Payment verification failed: ${error.message}`, 500));
  }
});

/**
 * Get Order Status
 * GET /api/v1/cashfree/status/:orderId
 */
export const getCashfreeOrderStatus = catchAsyncErrors(async (req, res, next) => {
  const { orderId } = req.params;

  if (!orderId) {
    return next(new ErrorHandler("Order ID is required", 400));
  }

  try {
    const orderDetails = await cashfreeRequest(`/orders/${orderId}`, "GET");

    res.status(200).json({
      success: true,
      orderId: orderDetails.order_id,
      orderAmount: orderDetails.order_amount,
      orderStatus: orderDetails.order_status,
    });

  } catch (error) {
    console.error("Cashfree Status Error:", error);
    return next(new ErrorHandler(`Failed to fetch order status: ${error.message}`, 500));
  }
});

/**
 * Webhook Handler for Cashfree
 * POST /api/v1/cashfree/webhook
 */
export const cashfreeWebhook = catchAsyncErrors(async (req, res, next) => {
  const signature = req.headers["x-cashfree-signature"];
  const timestamp = req.headers["x-cashfree-timestamp"];
  const rawBody = JSON.stringify(req.body);

  // Verify webhook signature
  const dataToSign = timestamp + rawBody;
  const expectedSignature = crypto
    .createHmac("sha256", CASHFREE_SECRET_KEY)
    .update(dataToSign)
    .digest("base64");

  if (signature !== expectedSignature) {
    console.warn("Invalid Cashfree Webhook Signature");
    return res.status(400).json({ success: false, message: "Invalid signature" });
  }

  // Process webhook event
  const event = req.body;
  console.log("Cashfree Webhook Received:", event.type);

  switch (event.type) {
    case "PAYMENT_SUCCESS":
      console.log(`✅ Payment Success: Order ${event.data.order.order_id}`);
      // Update order in database if needed
      break;
    case "PAYMENT_FAILED":
      console.log(`❌ Payment Failed: Order ${event.data.order.order_id}`);
      break;
    case "PAYMENT_USER_DROPPED":
      console.log(`⚠️ User Dropped: Order ${event.data.order.order_id}`);
      break;
    default:
      console.log(`Unknown event type: ${event.type}`);
  }

  res.status(200).json({ success: true });
});

/**
 * Callback URL Handler (for web redirects)
 * GET /api/v1/cashfree/callback
 */
export const cashfreeCallback = catchAsyncErrors(async (req, res, next) => {
  const { order_id } = req.query;

  // Redirect to app or show success page
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Payment Processing</title>
      <style>
        body { font-family: Arial, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: #f5f5f5; }
        .container { text-align: center; padding: 40px; background: white; border-radius: 16px; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
        h1 { color: #2E7D32; }
        p { color: #666; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>✅ Payment Processing</h1>
        <p>Order ID: ${order_id}</p>
        <p>Please return to the app to complete your order.</p>
      </div>
    </body>
    </html>
  `);
});
