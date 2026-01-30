import { catchAsyncErrors } from "../middlewares/catchAsyncErrors.js";
import ErrorHandler from "../middlewares/error.js";
import { FlashDeal } from "../models/flashDealSchema.js";

// Get Active Flash Deal (Public)
export const getActiveFlashDeal = catchAsyncErrors(async (req, res, next) => {
  // Find the most recently created deal
  const deal = await FlashDeal.findOne().sort({ createdAt: -1 });

  res.status(200).json({
    success: true,
    deal,
  });
});

// Create or Update Flash Deal (Admin)
export const updateFlashDeal = catchAsyncErrors(async (req, res, next) => {
  const { minOrderValue, discountPercentage, isActive, endDate } = req.body;

  // We can choose to always create a new one to keep history, or update the existing one.
  // For simplicity and audit log reasons mentioned in requirements, let's create a new one (acting as an update).
  
  const deal = await FlashDeal.create({
    minOrderValue,
    discountPercentage,
    isActive,
    endDate,
    createdAt: Date.now()
  });

  res.status(201).json({
    success: true,
    message: "Flash Deal Updated Successfully",
    deal,
  });
});
