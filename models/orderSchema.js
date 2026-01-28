import mongoose from "mongoose";

const orderSchema = new mongoose.Schema({
  trackingId: { 
    type: String, 
    unique: true 
  },
  user: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "User", 
    required: true 
  },
  shippingAddress: {
    details: { type: String, required: true },
    city: { type: String, required: true },
    state: { type: String, required: true },
    pincode: { type: String, required: true },
    phone: { type: String, required: true }
  },
  orderItems: [
    {
      product: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: "Product", 
        required: true 
      },
      name: { type: String, required: true },
      quantity: { type: Number, required: true },
      price: { type: Number, required: true },
      image: { type: String, required: true }
    }
  ],
  paymentInfo: {
    id: String,
    status: String,
    method: { type: String, enum: ["COD", "Online"], default: "COD" }
  },
  coupon: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "Coupon" 
  },
  pricing: {
    itemsPrice: { type: Number, default: 0 },
    taxPrice: { type: Number, default: 0 },
    shippingPrice: { type: Number, default: 0 },
    discountAmount: { type: Number, default: 0 },
    totalPrice: { type: Number, default: 0 }
  },
  orderStatus: {
    type: String,
    required: true,
    enum: ["Placed", "Confirmed", "Packed", "Out for Delivery", "Delivered", "Cancelled"],
    default: "Placed"
  },
  deliverySlot: {
    date: { type: Date },
    timeSlot: { type: String } // e.g., "10:00 AM - 12:00 PM"
  },
  timeline: [
    {
      status: String,
      timestamp: { type: Date, default: Date.now }
    }
  ],
  deliveredAt: Date,
  createdAt: { type: Date, default: Date.now },
  orderType: {
    type: String,
    enum: ["B2C", "B2B"],
    default: "B2C"
  }
});

// Pre-save to generate Tracking ID if not exists
orderSchema.pre('save', async function(next) {
  if (!this.trackingId) {
    const date = new Date();
    const prefix = "ORD";
    const random = Math.floor(100000 + Math.random() * 900000); // 6 digit random
    this.trackingId = `${prefix}${random}`; // Simple ID: ORD123456
  }
  next();
});

export const Order = mongoose.model("Order", orderSchema);
