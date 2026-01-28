import mongoose from "mongoose";

const deliverySlotSchema = new mongoose.Schema({
  date: { 
    type: Date, 
    required: true 
  }, // e.g., 2024-01-30 (Time set to 00:00:00)
  timeSlot: { 
    type: String, 
    required: true 
  }, // "10:00 AM - 12:00 PM"
  capacity: { 
    type: Number, 
    default: 20 
  },
  bookedCount: { 
    type: Number, 
    default: 0 
  },
  isActive: { 
    type: Boolean, 
    default: true 
  },
});

// Composite index to ensure unique slots per day
deliverySlotSchema.index({ date: 1, timeSlot: 1 }, { unique: true });

export const DeliverySlot = mongoose.model("DeliverySlot", deliverySlotSchema);
