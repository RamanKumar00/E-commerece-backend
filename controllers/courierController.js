import { catchAsyncErrors } from "../middlewares/catchAsyncErrors.js";
import ErrorHandler from "../middlewares/error.js";
import { Order } from "../models/orderSchema.js";
import { Shipment } from "../models/shipmentSchema.js";
import { CourierPartner } from "../models/courierPartnerSchema.js";
import courierManager from "../services/courier/CourierManager.js";

// Initialize courier services on server start
courierManager.initialize();

// ==================== SERVICEABILITY ====================

/**
 * Check if delivery is possible for a pincode
 */
export const checkServiceability = catchAsyncErrors(async (req, res, next) => {
  const { pickupPincode, deliveryPincode, cod } = req.body;

  if (!pickupPincode || !deliveryPincode) {
    return next(new ErrorHandler("Pickup and delivery pincode are required", 400));
  }

  const results = await courierManager.checkServiceability(
    pickupPincode,
    deliveryPincode,
    cod || false
  );

  res.status(200).json({
    success: true,
    data: {
      serviceable: results.some(r => r.serviceable),
      couriers: results,
    },
  });
});

// ==================== RATES ====================

/**
 * Get shipping rates from all couriers
 */
export const getRates = catchAsyncErrors(async (req, res, next) => {
  const { pickupPincode, deliveryPincode, weight, cod, codAmount } = req.query;

  if (!pickupPincode || !deliveryPincode || !weight) {
    return next(new ErrorHandler("Missing required parameters", 400));
  }

  const rates = await courierManager.getAllRates({
    pickupPincode,
    deliveryPincode,
    weight: parseFloat(weight),
    cod: cod === 'true',
    codAmount: codAmount ? parseFloat(codAmount) : 0,
  });

  res.status(200).json({
    success: true,
    data: {
      rates,
      cheapest: rates[0] || null,
      fastest: rates.sort((a, b) => 
        parseInt(a.estimatedDays || 7) - parseInt(b.estimatedDays || 7)
      )[0] || null,
    },
  });
});

/**
 * Get recommended courier based on smart routing
 */
export const getRecommendedCourier = catchAsyncErrors(async (req, res, next) => {
  const { pickupPincode, deliveryPincode, weight, cod, codAmount, priority } = req.body;

  if (!pickupPincode || !deliveryPincode || !weight) {
    return next(new ErrorHandler("Missing required parameters", 400));
  }

  const recommendation = await courierManager.recommendCourier({
    pickupPincode,
    deliveryPincode,
    weight: parseFloat(weight),
    cod: cod || false,
    codAmount: codAmount || 0,
    priority: priority || 'Normal',
  });

  if (!recommendation) {
    return next(new ErrorHandler("No courier available for this route", 404));
  }

  res.status(200).json({
    success: true,
    data: {
      recommended: recommendation,
      reason: `Best match based on ${priority || 'Normal'} priority`,
    },
  });
});

// ==================== SHIPMENT CREATION ====================

/**
 * Create shipment for an order
 */
export const createShipment = catchAsyncErrors(async (req, res, next) => {
  const { orderId, courierName, autoSelect } = req.body;

  if (!orderId) {
    return next(new ErrorHandler("Order ID is required", 400));
  }

  // Get order details
  const order = await Order.findById(orderId).populate('items.productId');

  if (!order) {
    return next(new ErrorHandler("Order not found", 404));
  }

  if (order.orderStatus !== "Packed") {
    return next(new ErrorHandler("Order must be in Packed status", 400));
  }

  // Check if shipment already exists
  const existingShipment = await Shipment.findOne({ orderId });
  if (existingShipment) {
    return next(new ErrorHandler("Shipment already created for this order", 400));
  }

  // Determine courier
  let selectedCourier = courierName;
  
  if (autoSelect || !courierName) {
    const recommendation = await courierManager.recommendCourier({
      pickupPincode: "110001", // Get from warehouse/shop settings
      deliveryPincode: order.shippingAddress.pincode,
      weight: order.items.reduce((sum, item) => sum + (parseFloat(item.weight) || 0.5) * item.quantity, 0),
      cod: order.paymentMethod === "COD",
      codAmount: order.paymentMethod === "COD" ? order.totalAmount : 0,
      priority: order.deliveryPriority || 'Normal',
    });

    if (!recommendation) {
      return next(new ErrorHandler("No courier available", 404));
    }

    selectedCourier = recommendation.courierService;
  }

  // Prepare shipment data
  const shipmentData = {
    orderId: order._id.toString(),
    paymentMethod: order.paymentMethod,
    billing: {
      name: order.shippingAddress.name || order.user?.name || "Customer",
      phone: order.shippingAddress.phone,
      address: order.shippingAddress.address,
      city: order.shippingAddress.city,
      state: order.shippingAddress.state,
      pincode: order.shippingAddress.pincode,
      email: order.user?.email,
    },
    shipping: {
      name: order.shippingAddress.name || order.user?.name || "Customer",
      phone: order.shippingAddress.phone,
      address: order.shippingAddress.address,
      city: order.shippingAddress.city,
      state: order.shippingAddress.state,
      pincode: order.shippingAddress.pincode,
      email: order.user?.email,
    },
    items: order.items.map(item => ({
      productId: item.productId._id,
      name: item.productId.productName,
      sku: item.productId._id,
      quantity: item.quantity,
      price: item.priceAtPurchase,
      discount: 0,
      tax: item.gst || 0,
      hsn: item.productId.hsnCode || "",
      weight: item.productId.weight || "0.5",
    })),
    weight: order.items.reduce((sum, item) => sum + (parseFloat(item.productId?.weight || 0.5)) * item.quantity, 0),
    dimensions: {
      length: 20,
      breadth: 20,
      height: 10,
    },
    subTotal: order.totalAmount - (order.shippingCharges || 0),
    shippingCharges: order.shippingCharges || 0,
    discount: order.discount || 0,
    codAmount: order.paymentMethod === "COD" ? order.totalAmount : 0,
    notes: order.notes || "",
  };

  // Create shipment
  const result = await courierManager.createShipment(
    selectedCourier,
    shipmentData,
    order._id
  );

  if (result.success) {
    // Update order status
    order.orderStatus = "Shipped";
    order.shippingInfo = {
      courier: selectedCourier,
      awbNumber: result.awbNumber,
      trackingNumber: result.trackingNumber,
    };
    await order.save();

    res.status(200).json({
      success: true,
      message: "Shipment created successfully",
      data: {
        shipment: result.shipment,
        awbNumber: result.awbNumber,
        trackingNumber: result.trackingNumber,
        courierName: selectedCourier,
      },
    });
  } else {
    return next(new ErrorHandler("Failed to create shipment", 500));
  }
});

// ==================== TRACKING ====================

/**
 * Track shipment by AWB number
 */
export const trackShipment = catchAsyncErrors(async (req, res, next) => {
  const { awb } = req.params;

  if (!awb) {
    return next(new ErrorHandler("AWB number is required", 400));
  }

  const result = await courierManager.trackShipment(awb);

  if (!result) {
    return next(new ErrorHandler("Shipment not found", 404));
  }

  res.status(200).json({
    success: true,
    data: result,
  });
});

/**
 * Get tracking history
 */
export const getTrackingHistory = catchAsyncErrors(async (req, res, next) => {
  const { awb } = req.params;

  const history = await courierManager.getTrackingHistory(awb);

  res.status(200).json({
    success: true,
    data: {
      awbNumber: awb,
      history,
    },
  });
});

/**
 * Track by Order ID
 */
export const trackByOrderId = catchAsyncErrors(async (req, res, next) => {
  const { orderId } = req.params;

  const shipment = await Shipment.findOne({ orderId }).populate('courierId');

  if (!shipment) {
    return next(new ErrorHandler("No shipment found for this order", 404));
  }

  const tracking = await courierManager.trackShipment(shipment.awbNumber);

  res.status(200).json({
    success: true,
    data: {
      shipment,
      tracking,
    },
  });
});

// ==================== CANCELLATION ====================

/**
 * Cancel shipment
 */
export const cancelShipment = catchAsyncErrors(async (req, res, next) => {
  const { awb, reason } = req.body;

  if (!awb) {
    return next(new ErrorHandler("AWB number is required", 400));
  }

  const result = await courierManager.cancelShipment(awb, reason || "Cancelled by admin");

  if (result.success) {
    // Update order status
    const order = await Order.findById(result.shipment.orderId);
    if (order) {
      order.orderStatus = "Cancelled";
      await order.save();
    }

    res.status(200).json({
      success: true,
      message: "Shipment cancelled successfully",
      data: result.shipment,
    });
  } else {
    return next(new ErrorHandler(result.message || "Cancellation failed", 400));
  }
});

// ==================== WEBHOOKS ====================

/**
 * Webhook endpoint for courier updates
 */
export const handleWebhook = catchAsyncErrors(async (req, res, next) => {
  const { courierName } = req.params;
  const signature = req.headers['x-webhook-signature'] || req.headers['x-signature'];

  try {
    const result = await courierManager.processWebhook(
      courierName,
      req.body,
      signature
    );

    if (result.success) {
      // Update order status based on shipment status
      if (result.shipment) {
        const order = await Order.findById(result.shipment.orderId);
        if (order) {
          if (result.shipment.shipmentStatus === "Delivered") {
            order.orderStatus = "Delivered";
            order.deliveredAt = new Date();
          } else if (result.shipment.shipmentStatus === "Out for Delivery") {
            order.orderStatus = "Out for Delivery";
          }
          await order.save();
        }
      }

      res.status(200).json({ success: true, message: "Webhook processed" });
    } else {
      res.status(400).json({ success: false, message: result.message });
    }
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ success: false, message: "Webhook processing failed" });
  }
});

// ==================== MANAGEMENT ====================

/**
 * Get all courier partners
 */
export const getCourierPartners = catchAsyncErrors(async (req, res, next) => {
  const partners = await CourierPartner.find();

  res.status(200).json({
    success: true,
    data: {
      partners,
    },
  });
});

/**
 * Get courier performance statistics
 */
export const getPerformanceStats = catchAsyncErrors(async (req, res, next) => {
  const stats = await courierManager.getPerformanceStats();

  res.status(200).json({
    success: true,
    data: {
      stats,
    },
  });
});

/**
 * Get all shipments with filters
 */
export const getShipments = catchAsyncErrors(async (req, res, next) => {
  const { status, courierName, page = 1, limit = 20 } = req.query;

  const filter = {};
  if (status) filter.shipmentStatus = status;
  if (courierName) filter.courierName = courierName;

  const skip = (parseInt(page) - 1) * parseInt(limit);

  const shipments = await Shipment.find(filter)
    .populate('orderId')
    .populate('courierId')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit));

  const total = await Shipment.countDocuments(filter);

  res.status(200).json({
    success: true,
    data: {
      shipments,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / parseInt(limit)),
      },
    },
  });
});
