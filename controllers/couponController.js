import { catchAsyncErrors } from "../middlewares/catchAsyncErrors.js";
import ErrorHandler from "../middlewares/error.js";
import { Coupon } from "../models/couponSchema.js";

// Create Coupon (Admin)
export const createCoupon = catchAsyncErrors(async (req, res, next) => {
  const { code, discountType, discountValue, expiryDate, minOrderValue, maxDiscountAmount, description } = req.body;

  if (!code || !discountType || !discountValue || !expiryDate) {
    return next(new ErrorHandler("Please fill full coupon details!", 400));
  }

  const existingCoupon = await Coupon.findOne({ code: code.toUpperCase() });
  if (existingCoupon) {
    return next(new ErrorHandler("Coupon code already exists!", 400));
  }

  const coupon = await Coupon.create({
    code,
    discountType,
    discountValue,
    expiryDate,
    minOrderValue,
    maxDiscountAmount,
    description
  });

  res.status(201).json({
    success: true,
    message: "Coupon created successfully!",
    coupon,
  });
});

// Get All Coupons
export const getAllCoupons = catchAsyncErrors(async (req, res, next) => {
  const coupons = await Coupon.find().sort({ createdAt: -1 });

  res.status(200).json({
    success: true,
    coupons,
  });
});

// Get Active Coupons (For Users)
export const getActiveCoupons = catchAsyncErrors(async (req, res, next) => {
  const currentDate = new Date();
  const coupons = await Coupon.find({
    expiryDate: { $gt: currentDate },
    isActive: true
  });

  res.status(200).json({
    success: true,
    coupons,
  });
});

// Validate & Apply Coupon
export const applyCoupon = catchAsyncErrors(async (req, res, next) => {
  const { code, cartTotal } = req.body;

  if (!code) {
    return next(new ErrorHandler("Please provide a coupon code!", 400));
  }

  const coupon = await Coupon.findOne({ code: code.toUpperCase(), isActive: true });

  if (!coupon) {
    return next(new ErrorHandler("Invalid or expired coupon code", 404));
  }

  if (new Date() > coupon.expiryDate) {
    return next(new ErrorHandler("This coupon has expired", 400));
  }

  if (coupon.usedCount >= coupon.usageLimit) {
    return next(new ErrorHandler("Coupon usage limit exceeded", 400));
  }

  if (cartTotal < coupon.minOrderValue) {
    return next(new ErrorHandler(`Minimum order value of ₹${coupon.minOrderValue} required`, 400));
  }

  // Calculate Discount
  let discountAmount = 0;
  if (coupon.discountType === "Flat") {
    discountAmount = coupon.discountValue;
  } else {
    discountAmount = (cartTotal * coupon.discountValue) / 100;
    if (coupon.maxDiscountAmount) {
      discountAmount = Math.min(discountAmount, coupon.maxDiscountAmount);
    }
  }

  res.status(200).json({
    success: true,
    discountAmount,
    couponCode: coupon.code,
    message: "Coupon applied successfully!",
  });
});

// Delete Coupon (Admin)
export const deleteCoupon = catchAsyncErrors(async (req, res, next) => {
  const { id } = req.params;
  const coupon = await Coupon.findById(id);

  if (!coupon) {
    return next(new ErrorHandler("Coupon not found", 404));
  }

  await coupon.deleteOne();

  res.status(200).json({
    success: true,
    message: "Coupon deleted successfully!",
  });
});
