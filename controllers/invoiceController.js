import { catchAsyncErrors } from "../middlewares/catchAsyncErrors.js";
import ErrorHandler from "../middlewares/error.js";
import { Invoice } from "../models/invoiceSchema.js";
import { Order } from "../models/orderSchema.js";
import { User } from "../models/userSchema.js";

// Company Settings (can be moved to a separate config/database later)
const COMPANY_SETTINGS = {
  name: "Aman Enterprises",
  address: "123 Business Street",
  city: "Your City",
  state: "Your State",
  pincode: "000000",
  phone: "+91 9097037320",
  email: "contact@amanenterprises.com",
  gstin: "22AAAAA0000A1Z5", // Replace with actual GSTIN
  pan: "AAAAA0000A",
  logo: null,
  stateCode: "22" // State code for GST (e.g., 22 for Chhattisgarh)
};

// GST Rates (can be configured per product category)
const DEFAULT_GST_RATE = 18; // 18% default GST

// Helper: Determine if transaction is inter-state or intra-state
const isInterState = (sellerState, buyerState) => {
  return sellerState.toLowerCase() !== buyerState.toLowerCase();
};

// Helper: Calculate GST breakdown
const calculateGST = (amount, rate, isInterStateTransaction) => {
  const taxAmount = (amount * rate) / 100;
  
  if (isInterStateTransaction) {
    return {
      cgst: 0,
      sgst: 0,
      igst: taxAmount,
      cgstRate: 0,
      sgstRate: 0,
      igstRate: rate
    };
  } else {
    const halfRate = rate / 2;
    const halfTax = taxAmount / 2;
    return {
      cgst: halfTax,
      sgst: halfTax,
      igst: 0,
      cgstRate: halfRate,
      sgstRate: halfRate,
      igstRate: 0
    };
  }
};

// @desc    Generate invoice for an order
// @route   POST /api/v1/invoice/generate/:orderId
// @access  Private
export const generateInvoice = catchAsyncErrors(async (req, res, next) => {
  const { orderId } = req.params;
  const userId = req.user._id;

  // Check if invoice already exists for this order
  const existingInvoice = await Invoice.findOne({ order: orderId });
  if (existingInvoice) {
    return res.status(200).json({
      success: true,
      message: "Invoice already exists",
      invoice: existingInvoice
    });
  }

  // Get order details
  const order = await Order.findById(orderId)
    .populate("orderItems.product", "productName description unit");

  if (!order) {
    return next(new ErrorHandler("Order not found", 404));
  }

  // Verify ownership or admin
  if (order.user.toString() !== userId.toString() && req.user.role !== "Admin") {
    return next(new ErrorHandler("Not authorized to generate invoice for this order", 403));
  }

  // Get user details
  const user = await User.findById(order.user);

  // Determine if inter-state transaction
  const interState = isInterState(COMPANY_SETTINGS.state, order.shippingAddress.state);

  // Process order items
  let subtotal = 0;
  const invoiceItems = order.orderItems.map(item => {
    const unitPrice = item.price;
    const quantity = item.quantity;
    const itemTotal = unitPrice * quantity;
    const taxableAmount = itemTotal; // Assuming prices are exclusive of tax
    
    const gst = calculateGST(taxableAmount, DEFAULT_GST_RATE, interState);
    const totalWithTax = taxableAmount + gst.cgst + gst.sgst + gst.igst;
    
    subtotal += itemTotal;

    return {
      productId: item.product,
      name: item.name,
      description: "",
      hsn: "", // HSN code can be added per product
      quantity: quantity,
      unit: "pcs",
      unitPrice: unitPrice,
      discount: 0,
      taxableAmount: taxableAmount,
      cgstRate: gst.cgstRate,
      cgstAmount: gst.cgst,
      sgstRate: gst.sgstRate,
      sgstAmount: gst.sgst,
      igstRate: gst.igstRate,
      igstAmount: gst.igst,
      totalAmount: totalWithTax
    };
  });

  // Calculate totals
  const totalDiscount = order.pricing.discountAmount || 0;
  const taxableAmount = subtotal - totalDiscount;
  const gstTotals = calculateGST(taxableAmount, DEFAULT_GST_RATE, interState);
  const totalTax = gstTotals.cgst + gstTotals.sgst + gstTotals.igst;
  const shippingCharges = order.pricing.shippingPrice || 0;
  const grandTotal = taxableAmount + totalTax + shippingCharges;
  const roundOff = Math.round(grandTotal) - grandTotal;

  // Create invoice
  const invoice = await Invoice.create({
    order: orderId,
    user: order.user,
    companyDetails: COMPANY_SETTINGS,
    customerDetails: {
      name: user.shopName,
      phone: user.phone,
      email: user.email,
      address: order.shippingAddress.details,
      city: order.shippingAddress.city,
      state: order.shippingAddress.state,
      pincode: order.shippingAddress.pincode,
      gstin: "" // Customer GSTIN if available
    },
    items: invoiceItems,
    pricing: {
      subtotal: subtotal,
      totalDiscount: totalDiscount,
      taxableAmount: taxableAmount,
      cgstTotal: gstTotals.cgst,
      sgstTotal: gstTotals.sgst,
      igstTotal: gstTotals.igst,
      totalTax: totalTax,
      shippingCharges: shippingCharges,
      roundOff: roundOff,
      grandTotal: Math.round(grandTotal)
    },
    gstDetails: {
      isIntraState: !interState,
      placeOfSupply: order.shippingAddress.state,
      taxSlabs: [{
        rate: DEFAULT_GST_RATE,
        taxableAmount: taxableAmount,
        cgst: gstTotals.cgst,
        sgst: gstTotals.sgst,
        igst: gstTotals.igst
      }]
    },
    paymentInfo: {
      method: order.paymentInfo.method,
      status: order.paymentInfo.status === "success" ? "Paid" : "Pending",
      transactionId: order.paymentInfo.id || ""
    },
    invoiceDate: new Date(),
    status: "generated"
  });

  // Generate checksum
  invoice.checksum = invoice.generateChecksum();
  await invoice.save();

  res.status(201).json({
    success: true,
    message: "Invoice generated successfully",
    invoice
  });
});

// @desc    Get invoice by order ID
// @route   GET /api/v1/invoice/order/:orderId
// @access  Private
export const getInvoiceByOrder = catchAsyncErrors(async (req, res, next) => {
  const { orderId } = req.params;
  const userId = req.user._id;

  const invoice = await Invoice.findOne({ order: orderId })
    .populate("order", "trackingId orderStatus createdAt");

  if (!invoice) {
    return next(new ErrorHandler("Invoice not found for this order", 404));
  }

  // Verify ownership or admin
  if (invoice.user.toString() !== userId.toString() && req.user.role !== "Admin") {
    return next(new ErrorHandler("Not authorized to view this invoice", 403));
  }

  res.status(200).json({
    success: true,
    invoice
  });
});

// @desc    Get invoice by invoice number
// @route   GET /api/v1/invoice/:invoiceNumber
// @access  Private
export const getInvoiceByNumber = catchAsyncErrors(async (req, res, next) => {
  const { invoiceNumber } = req.params;
  const userId = req.user._id;

  const invoice = await Invoice.findOne({ invoiceNumber })
    .populate("order", "trackingId orderStatus createdAt");

  if (!invoice) {
    return next(new ErrorHandler("Invoice not found", 404));
  }

  // Verify ownership or admin
  if (invoice.user.toString() !== userId.toString() && req.user.role !== "Admin") {
    return next(new ErrorHandler("Not authorized to view this invoice", 403));
  }

  res.status(200).json({
    success: true,
    invoice
  });
});

// @desc    Get all user's invoices
// @route   GET /api/v1/invoice/my-invoices
// @access  Private
export const getMyInvoices = catchAsyncErrors(async (req, res, next) => {
  const userId = req.user._id;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;

  const skip = (page - 1) * limit;

  const invoices = await Invoice.find({ user: userId })
    .populate("order", "trackingId orderStatus createdAt")
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  const totalInvoices = await Invoice.countDocuments({ user: userId });

  res.status(200).json({
    success: true,
    invoices,
    pagination: {
      currentPage: page,
      totalPages: Math.ceil(totalInvoices / limit),
      totalInvoices
    }
  });
});

// ==================== ADMIN ROUTES ====================

// @desc    Get all invoices (Admin)
// @route   GET /api/v1/invoice/admin/all
// @access  Admin
export const getAllInvoicesAdmin = catchAsyncErrors(async (req, res, next) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const status = req.query.status;
  const startDate = req.query.startDate;
  const endDate = req.query.endDate;
  const searchQuery = req.query.search;

  // Build query
  const query = {};
  
  if (status) query.status = status;
  
  if (startDate || endDate) {
    query.invoiceDate = {};
    if (startDate) query.invoiceDate.$gte = new Date(startDate);
    if (endDate) query.invoiceDate.$lte = new Date(endDate);
  }

  if (searchQuery) {
    query.$or = [
      { invoiceNumber: { $regex: searchQuery, $options: "i" } },
      { "customerDetails.name": { $regex: searchQuery, $options: "i" } },
      { "customerDetails.phone": { $regex: searchQuery, $options: "i" } }
    ];
  }

  const skip = (page - 1) * limit;

  const invoices = await Invoice.find(query)
    .populate("order", "trackingId orderStatus")
    .populate("user", "shopName phone email")
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  const totalInvoices = await Invoice.countDocuments(query);

  res.status(200).json({
    success: true,
    invoices,
    pagination: {
      currentPage: page,
      totalPages: Math.ceil(totalInvoices / limit),
      totalInvoices
    }
  });
});

// @desc    Get GST summary report (Admin)
// @route   GET /api/v1/invoice/admin/gst-summary
// @access  Admin
export const getGSTSummary = catchAsyncErrors(async (req, res, next) => {
  const { startDate, endDate, period } = req.query;
  
  let start, end;
  
  if (period === "monthly") {
    start = new Date();
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
    end = new Date();
  } else if (period === "yearly") {
    start = new Date();
    start.setMonth(0, 1);
    start.setHours(0, 0, 0, 0);
    end = new Date();
  } else if (startDate && endDate) {
    start = new Date(startDate);
    end = new Date(endDate);
  } else {
    // Default to current month
    start = new Date();
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
    end = new Date();
  }

  const summary = await Invoice.getGSTSummary(start, end);

  // Monthly breakdown for yearly view
  let monthlyBreakdown = [];
  if (period === "yearly") {
    monthlyBreakdown = await Invoice.aggregate([
      {
        $match: {
          invoiceDate: { $gte: start, $lte: end },
          status: { $ne: "cancelled" }
        }
      },
      {
        $group: {
          _id: { $month: "$invoiceDate" },
          totalCGST: { $sum: "$pricing.cgstTotal" },
          totalSGST: { $sum: "$pricing.sgstTotal" },
          totalIGST: { $sum: "$pricing.igstTotal" },
          totalRevenue: { $sum: "$pricing.grandTotal" },
          invoiceCount: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);
  }

  res.status(200).json({
    success: true,
    period: { start, end },
    summary,
    monthlyBreakdown
  });
});

// @desc    Update company GST details (Admin)
// @route   PUT /api/v1/invoice/admin/company-settings
// @access  Admin
export const updateCompanySettings = catchAsyncErrors(async (req, res, next) => {
  const { name, address, city, state, pincode, phone, email, gstin, pan, logo } = req.body;

  // In a real app, save to database. For now, just validate and return
  const updatedSettings = {
    name: name || COMPANY_SETTINGS.name,
    address: address || COMPANY_SETTINGS.address,
    city: city || COMPANY_SETTINGS.city,
    state: state || COMPANY_SETTINGS.state,
    pincode: pincode || COMPANY_SETTINGS.pincode,
    phone: phone || COMPANY_SETTINGS.phone,
    email: email || COMPANY_SETTINGS.email,
    gstin: gstin || COMPANY_SETTINGS.gstin,
    pan: pan || COMPANY_SETTINGS.pan,
    logo: logo || COMPANY_SETTINGS.logo
  };

  // TODO: Save to database/config file
  
  res.status(200).json({
    success: true,
    message: "Company settings updated successfully",
    settings: updatedSettings
  });
});

// @desc    Export invoices (Admin)
// @route   GET /api/v1/invoice/admin/export
// @access  Admin
export const exportInvoices = catchAsyncErrors(async (req, res, next) => {
  const { startDate, endDate, format } = req.query;
  
  const query = {
    status: { $ne: "cancelled" }
  };
  
  if (startDate || endDate) {
    query.invoiceDate = {};
    if (startDate) query.invoiceDate.$gte = new Date(startDate);
    if (endDate) query.invoiceDate.$lte = new Date(endDate);
  }

  const invoices = await Invoice.find(query)
    .populate("order", "trackingId")
    .sort({ invoiceDate: -1 });

  // Format for CSV export
  const exportData = invoices.map(inv => ({
    invoiceNumber: inv.invoiceNumber,
    invoiceDate: inv.invoiceDate.toISOString().split('T')[0],
    orderTrackingId: inv.order?.trackingId || "",
    customerName: inv.customerDetails.name,
    customerPhone: inv.customerDetails.phone,
    customerGSTIN: inv.customerDetails.gstin || "",
    subtotal: inv.pricing.subtotal,
    discount: inv.pricing.totalDiscount,
    taxableAmount: inv.pricing.taxableAmount,
    cgst: inv.pricing.cgstTotal,
    sgst: inv.pricing.sgstTotal,
    igst: inv.pricing.igstTotal,
    totalTax: inv.pricing.totalTax,
    grandTotal: inv.pricing.grandTotal,
    paymentMethod: inv.paymentInfo.method,
    paymentStatus: inv.paymentInfo.status,
    status: inv.status
  }));

  res.status(200).json({
    success: true,
    count: exportData.length,
    data: exportData
  });
});

// @desc    Cancel an invoice (Admin)
// @route   PUT /api/v1/invoice/admin/:invoiceId/cancel
// @access  Admin
export const cancelInvoice = catchAsyncErrors(async (req, res, next) => {
  const { invoiceId } = req.params;
  const { reason } = req.body;

  const invoice = await Invoice.findById(invoiceId);

  if (!invoice) {
    return next(new ErrorHandler("Invoice not found", 404));
  }

  if (invoice.status === "cancelled") {
    return next(new ErrorHandler("Invoice is already cancelled", 400));
  }

  invoice.status = "cancelled";
  invoice.notes = `Cancelled: ${reason || "No reason provided"}`;
  await invoice.save();

  res.status(200).json({
    success: true,
    message: "Invoice cancelled successfully",
    invoice
  });
});
