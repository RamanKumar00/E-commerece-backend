import mongoose from "mongoose";

const flashDealSchema = new mongoose.Schema({
  minOrderValue: { 
    type: Number, 
    required: [true, "Please enter minimum order value"],
    default: 1000 
  },
  discountPercentage: { 
    type: Number, 
    required: [true, "Please enter discount percentage"],
    default: 5 
  },
  isActive: { 
    type: Boolean, 
    default: true 
  },
  startDate: { 
    type: Date, 
    default: Date.now 
  },
  endDate: { 
    type: Date 
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

export const FlashDeal = mongoose.model("FlashDeal", flashDealSchema);
