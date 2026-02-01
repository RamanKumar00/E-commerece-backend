import mongoose from "mongoose";

const trackingLogSchema = new mongoose.Schema({
  shipmentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Shipment",
    required: true,
    index: true,
  },
  awbNumber: {
    type: String,
    required: true,
    index: true,
  },
  status: {
    type: String,
    required: true,
  },
  statusCode: String,
  location: {
    city: String,
    state: String,
    country: String,
    pincode: String,
    hubName: String,
  },
  description: String,
  remarks: String,
  timestamp: {
    type: Date,
    required: true,
    index: true,
  },
  source: {
    type: String,
    enum: ["API", "Webhook", "Manual", "System"],
    default: "API",
  },
  courierName: String,
  rawData: mongoose.Schema.Types.Mixed,
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Compound index for efficient queries
trackingLogSchema.index({ shipmentId: 1, timestamp: -1 });
trackingLogSchema.index({ awbNumber: 1, timestamp: -1 });

export const TrackingLog = mongoose.model("TrackingLog", trackingLogSchema);
