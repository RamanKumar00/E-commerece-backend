import mongoose from "mongoose";

const courierPartnerSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    enum: ["Shiprocket", "Delhivery", "Shadowfax", "Manual"],
  },
  displayName: {
    type: String,
    required: true,
  },
  apiBaseUrl: {
    type: String,
  },
  credentials: {
    apiKey: {
      type: String,
      select: false, // Don't return in queries by default
    },
    apiSecret: {
      type: String,
      select: false,
    },
    token: {
      type: String,
      select: false,
    },
    tokenExpiry: {
      type: Date,
    },
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  supportedServices: [{
    type: String,
    enum: ["Standard", "Express", "SameDay", "NextDay", "Surface", "Air"],
  }],
  configuration: {
    webhookUrl: String,
    webhookSecret: String,
    allowedIPs: [String],
    maxRetries: {
      type: Number,
      default: 3,
    },
    timeoutSeconds: {
      type: Number,
      default: 30,
    },
  },
  performance: {
    totalShipments: {
      type: Number,
      default: 0,
    },
    successfulDeliveries: {
      type: Number,
      default: 0,
    },
    failedDeliveries: {
      type: Number,
      default: 0,
    },
    rtoCount: {
      type: Number,
      default: 0,
    },
    averageDeliveryDays: {
      type: Number,
      default: 0,
    },
    onTimeDeliveryRate: {
      type: Number,
      default: 0,
    },
    lastUpdated: {
      type: Date,
    },
  },
  pricing: {
    baseFee: Number,
    perKgRate: Number,
    codCharges: Number,
    rtoCharges: Number,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Update timestamp on save
courierPartnerSchema.pre("save", function (next) {
  this.updatedAt = Date.now();
  next();
});

// Calculate delivery rate
courierPartnerSchema.methods.getDeliverySuccessRate = function() {
  const total = this.performance.totalShipments;
  if (total === 0) return 0;
  return ((this.performance.successfulDeliveries / total) * 100).toFixed(2);
};

// Calculate RTO rate
courierPartnerSchema.methods.getRTORate = function() {
  const total = this.performance.totalShipments;
  if (total === 0) return 0;
  return ((this.performance.rtoCount / total) * 100).toFixed(2);
};

export const CourierPartner = mongoose.model("CourierPartner", courierPartnerSchema);
