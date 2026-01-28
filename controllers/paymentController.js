import { catchAsyncErrors } from "../middlewares/catchAsyncErrors.js";
import ErrorHandler from "../middlewares/error.js";
import Razorpay from "razorpay";
import crypto from "crypto";

// Initialize Razorpay
// NOTE: User needs to add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to .env
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || "rzp_test_PLACEHOLDER",
  key_secret: process.env.RAZORPAY_KEY_SECRET || "PLACEHOLDER",
});

// Create Order (Initiate Payment)
export const createPaymentOrder = catchAsyncErrors(async (req, res, next) => {
  const { amount } = req.body; // Amount in INR

  if (!amount) {
    return next(new ErrorHandler("Please enter amount", 400));
  }

  const options = {
    amount: amount * 100, // Amount in paise
    currency: "INR",
    receipt: `receipt_${Date.now()}`,
  };

  try {
    const order = await razorpay.orders.create(options);
    res.status(200).json({
      success: true,
      order,
    });
  } catch (error) {
    return next(new ErrorHandler(error.message, 500));
  }
});

// Verify Payment Signature
export const verifyPayment = catchAsyncErrors(async (req, res, next) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

  const body = razorpay_order_id + "|" + razorpay_payment_id;

  const expectedSignature = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET || "PLACEHOLDER")
    .update(body.toString())
    .digest("hex");

  const isAuthentic = expectedSignature === razorpay_signature;

  if (isAuthentic) {
    // Database comes here? 
    // Usually we return success, and then the Client calls 'placeOrder' with payment info.
    // Or we can save the transaction here.
    
    res.status(200).json({
      success: true,
      message: "Payment verified successfully",
      paymentId: razorpay_payment_id
    });
  } else {
    return next(new ErrorHandler("Payment verification failed", 400));
  }
});

// Get Key (To send Key ID to frontend)
export const getRazorpayKey = catchAsyncErrors(async (req, res, next) => {
  res.status(200).json({
    success: true,
    key: process.env.RAZORPAY_KEY_ID || "rzp_test_PLACEHOLDER",
  });
});
