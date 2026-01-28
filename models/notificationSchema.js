import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema({
  user: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "User", 
    required: true 
  },
  title: { 
    type: String, 
    required: true 
  },
  message: { 
    type: String, 
    required: true 
  },
  type: { 
    type: String, 
    enum: ["Order", "Offer", "General"], 
    default: "General" 
  },
  metadata: {
    orderId: String,
    couponCode: String
  },
  isRead: { 
    type: Boolean, 
    default: false 
  },
  createdAt: { 
    type: Date, 
    default: Date.now,
    expires: '30d' // Auto-delete after 30 days
  }
});

export const Notification = mongoose.model("Notification", notificationSchema);
