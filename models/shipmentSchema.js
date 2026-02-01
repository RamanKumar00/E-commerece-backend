import mongoose from "mongoose";

const shipmentSchema = new mongoose.Schema({
  orderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Order",
    required: true,
    index: true,
  },
  courierId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "CourierPartner",
    required: true,
  },
  courierName: {
    type: String,
    required: true,
  },
  awbNumber: {
    type: String,
    unique: true,
    sparse: true,
    index: true,
  },
  trackingNumber: {
    type: String,
    index: true,
  },
  shipmentStatus: {
    type: String,
    enum: [
      "Created",
      "Manifest Generated",
      "Pickup Scheduled",
      "Picked Up",
      "In Transit",
      "Out for Delivery",
      "Delivered",
      "Failed Attempt",
      "RTO Initiated",
      "RTO Delivered",
      "Cancelled",
      "Lost",
      "Damaged",
    ],
    default: "Created",
    index: true,
  },
  currentLocation: {
    city: String,
    state: String,
    country: String,
    pincode: String,
  },
  shipmentDetails: {
    weight: {
      type: Number,
      required: true,
    },
    length: Number,
    breadth: Number,
    height: Number,
    packageType: {
      type: String,
      enum: ["Box", "Envelope", "Bag", "Other"],
      default: "Box",
    },
    numberOfPackages: {
      type: Number,
      default: 1,
    },
    declaredValue: Number,
    isCOD: {
      type: Boolean,
      default: false,
    },
    codAmount: Number,
  },
  pickupDetails: {
    pickupDate: Date,
    pickupTime: String,
    pickupAddress: {
      name: String,
      phone: String,
      address: String,
      city: String,
      state: String,
      pincode: String,
    },
    actualPickupTime: Date,
  },
  deliveryDetails: {
    estimatedDeliveryDate: Date,
    estimatedDeliveryTime: String,
    actualDeliveryDate: Date,
    recipientName: String,
    recipientPhone: String,
    deliveryAddress: {
      name: String,
      phone: String,
      address: String,
      city: String,
      state: String,
      pincode: String,
    },
    deliveryInstructions: String,
  },
  pricing: {
    baseCharge: Number,
    codCharge: Number,
    fuelSurcharge: Number,
    gstAmount: Number,
    totalCharge: Number,
    currency: {
      type: String,
      default: "INR",
    },
  },
  labels: {
    shippingLabel: String, // URL or base64
    manifestUrl: String,
    invoiceUrl: String,
  },
  courierResponse: {
    createResponse: mongoose.Schema.Types.Mixed,
    trackingResponse: mongoose.Schema.Types.Mixed,
    cancelResponse: mongoose.Schema.Types.Mixed,
  },
  attemptHistory: [{
    attemptNumber: Number,
    attemptDate: Date,
    status: String,
    reason: String,
    location: String,
  }],
  isInsured: {
    type: Boolean,
    default: false,
  },
  insuranceAmount: Number,
  serviceType: {
    type: String,
    enum: ["Standard", "Express", "SameDay", "NextDay", "Surface", "Air"],
    default: "Standard",
  },
  priority: {
    type: String,
    enum: ["Low", "Normal", "High", "Urgent"],
    default: "Normal",
  },
  notes: String,
  cancelledAt: Date,
  cancellationReason: String,
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Indexes for performance
shipmentSchema.index({ orderId: 1, courierName: 1 });
shipmentSchema.index({ shipmentStatus: 1, createdAt: -1 });
shipmentSchema.index({ "deliveryDetails.estimatedDeliveryDate": 1 });

// Update timestamp on save
shipmentSchema.pre("save", function (next) {
  this.updatedAt = Date.now();
  next();
});

// Calculate days in transit
shipmentSchema.methods.getDaysInTransit = function() {
  if (!this.pickupDetails.actualPickupTime) return 0;
  const end = this.deliveryDetails.actualDeliveryDate || new Date();
  const start = this.pickupDetails.actualPickupTime;
  return Math.ceil((end - start) / (1000 * 60 * 60 * 24));
};

// Check if delivery is delayed
shipmentSchema.methods.isDelayed = function() {
  if (!this.deliveryDetails.estimatedDeliveryDate) return false;
  if (this.shipmentStatus === "Delivered") {
    return this.deliveryDetails.actualDeliveryDate > this.deliveryDetails.estimatedDeliveryDate;
  }
  return new Date() > this.deliveryDetails.estimatedDeliveryDate;
};

export const Shipment = mongoose.model("Shipment", shipmentSchema);
