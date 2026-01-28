import mongoose from "mongoose";

const couponSchema = new mongoose.Schema({
  code: { 
    type: String, 
    required: [true, "Please enter a coupon code"], 
    unique: true, 
    uppercase: true,
    trim: true
  },
  description: { type: String },
  discountType: { 
    type: String, 
    enum: ["Flat", "Percent"], 
    required: true 
  },
  discountValue: { 
    type: Number, 
    required: true 
  }, // Amount or Percentage
  
  minOrderValue: { type: Number, default: 0 },
  maxDiscountAmount: { type: Number }, // For percentage coupons (up to ₹100 off)
  
  expiryDate: { 
    type: Date, 
    required: true 
  },
  
  usageLimit: { type: Number, default: 1000 },
  usedCount: { type: Number, default: 0 },
  
  isActive: { type: Boolean, default: true }
});

export const Coupon = mongoose.model("Coupon", couponSchema);
