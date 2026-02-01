import mongoose from "mongoose";

const invoiceSchema = new mongoose.Schema({
  // Invoice Identification
  invoiceNumber: {
    type: String,
    unique: true,
    required: true
  },
  
  // References
  order: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Order",
    required: true,
    unique: true // One invoice per order
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  
  // Company Details (Seller)
  companyDetails: {
    name: { type: String, default: "Aman Enterprises" },
    address: { type: String, default: "123 Business Street, City" },
    city: { type: String, default: "Your City" },
    state: { type: String, default: "Your State" },
    pincode: { type: String, default: "000000" },
    phone: { type: String, default: "+91 9097037320" },
    email: { type: String, default: "contact@amanenterprises.com" },
    gstin: { type: String, default: "" }, // GST Identification Number
    pan: { type: String, default: "" },
    logo: { type: String } // URL to company logo
  },
  
  // Customer Details (Buyer)
  customerDetails: {
    name: { type: String, required: true },
    phone: { type: String, required: true },
    email: { type: String },
    address: { type: String, required: true },
    city: { type: String, required: true },
    state: { type: String, required: true },
    pincode: { type: String, required: true },
    gstin: { type: String } // Customer GSTIN (for B2B)
  },
  
  // Invoice Items
  items: [{
    productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
    name: { type: String, required: true },
    description: { type: String },
    hsn: { type: String }, // HSN/SAC Code for GST
    quantity: { type: Number, required: true },
    unit: { type: String, default: "pcs" },
    unitPrice: { type: Number, required: true },
    discount: { type: Number, default: 0 },
    taxableAmount: { type: Number, required: true },
    cgstRate: { type: Number, default: 0 },
    cgstAmount: { type: Number, default: 0 },
    sgstRate: { type: Number, default: 0 },
    sgstAmount: { type: Number, default: 0 },
    igstRate: { type: Number, default: 0 },
    igstAmount: { type: Number, default: 0 },
    totalAmount: { type: Number, required: true }
  }],
  
  // Pricing Summary
  pricing: {
    subtotal: { type: Number, required: true },
    totalDiscount: { type: Number, default: 0 },
    taxableAmount: { type: Number, required: true },
    cgstTotal: { type: Number, default: 0 },
    sgstTotal: { type: Number, default: 0 },
    igstTotal: { type: Number, default: 0 },
    totalTax: { type: Number, default: 0 },
    shippingCharges: { type: Number, default: 0 },
    roundOff: { type: Number, default: 0 },
    grandTotal: { type: Number, required: true }
  },
  
  // GST Details
  gstDetails: {
    isIntraState: { type: Boolean, default: true }, // Same state = CGST+SGST, Different = IGST
    placeOfSupply: { type: String },
    taxSlabs: [{
      rate: { type: Number },
      taxableAmount: { type: Number },
      cgst: { type: Number },
      sgst: { type: Number },
      igst: { type: Number }
    }]
  },
  
  // Payment Information
  paymentInfo: {
    method: { type: String, enum: ["COD", "Online", "Bank Transfer", "QR"], default: "COD" },
    status: { type: String, enum: ["Pending", "Paid", "Failed", "Refunded"], default: "Pending" },
    transactionId: { type: String },
    paidAt: { type: Date }
  },
  
  // Invoice Metadata
  invoiceDate: { type: Date, default: Date.now },
  dueDate: { type: Date },
  
  // PDF Storage
  pdfUrl: { type: String },
  pdfGeneratedAt: { type: Date },
  
  // Status
  status: {
    type: String,
    enum: ["draft", "generated", "sent", "paid", "cancelled"],
    default: "generated"
  },
  
  // Audit
  notes: { type: String },
  termsAndConditions: { type: String, default: "Goods once sold will not be taken back. Subject to local jurisdiction." },
  
  // For tamper-proof verification
  checksum: { type: String },
  
}, { 
  timestamps: true 
});

// Indexes
invoiceSchema.index({ invoiceNumber: 1 });
invoiceSchema.index({ order: 1 });
invoiceSchema.index({ user: 1, createdAt: -1 });
invoiceSchema.index({ "customerDetails.gstin": 1 });
invoiceSchema.index({ invoiceDate: -1 });
invoiceSchema.index({ status: 1 });

// Pre-save hook to generate invoice number
invoiceSchema.pre('save', async function(next) {
  if (!this.invoiceNumber) {
    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    
    // Get count of invoices this month for sequential numbering
    const count = await mongoose.model('Invoice').countDocuments({
      createdAt: {
        $gte: new Date(date.getFullYear(), date.getMonth(), 1),
        $lt: new Date(date.getFullYear(), date.getMonth() + 1, 1)
      }
    });
    
    const sequence = (count + 1).toString().padStart(4, '0');
    this.invoiceNumber = `AE${year}${month}${sequence}`; // Example: AE2602001
  }
  next();
});

// Static method to get GST summary for a period
invoiceSchema.statics.getGSTSummary = async function(startDate, endDate) {
  const summary = await this.aggregate([
    {
      $match: {
        invoiceDate: { $gte: startDate, $lte: endDate },
        status: { $ne: "cancelled" }
      }
    },
    {
      $group: {
        _id: null,
        totalInvoices: { $sum: 1 },
        totalTaxableAmount: { $sum: "$pricing.taxableAmount" },
        totalCGST: { $sum: "$pricing.cgstTotal" },
        totalSGST: { $sum: "$pricing.sgstTotal" },
        totalIGST: { $sum: "$pricing.igstTotal" },
        totalTax: { $sum: "$pricing.totalTax" },
        totalRevenue: { $sum: "$pricing.grandTotal" }
      }
    }
  ]);
  
  return summary[0] || {
    totalInvoices: 0,
    totalTaxableAmount: 0,
    totalCGST: 0,
    totalSGST: 0,
    totalIGST: 0,
    totalTax: 0,
    totalRevenue: 0
  };
};

// Generate checksum for tamper-proof verification
invoiceSchema.methods.generateChecksum = function() {
  const crypto = require('crypto');
  const data = `${this.invoiceNumber}|${this.order}|${this.pricing.grandTotal}|${this.invoiceDate}`;
  return crypto.createHash('sha256').update(data).digest('hex');
};

export const Invoice = mongoose.model("Invoice", invoiceSchema);
