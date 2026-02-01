import express from "express";
import {
  generateInvoice,
  getInvoiceByOrder,
  getInvoiceByNumber,
  getMyInvoices,
  getAllInvoicesAdmin,
  getGSTSummary,
  updateCompanySettings,
  exportInvoices,
  cancelInvoice
} from "../controllers/invoiceController.js";
import { isAuthenticated, authorizeAdmin } from "../middlewares/auth.js";

const router = express.Router();

// ==================== USER ROUTES (Authenticated) ====================
// Generate invoice for an order
router.post("/generate/:orderId", isAuthenticated, generateInvoice);

// Get invoice by order ID
router.get("/order/:orderId", isAuthenticated, getInvoiceByOrder);

// Get invoice by invoice number
router.get("/number/:invoiceNumber", isAuthenticated, getInvoiceByNumber);

// Get all user's invoices
router.get("/my-invoices", isAuthenticated, getMyInvoices);

// ==================== ADMIN ROUTES ====================
// Get all invoices (admin)
router.get("/admin/all", isAuthenticated, authorizeAdmin, getAllInvoicesAdmin);

// Get GST summary report (admin)
router.get("/admin/gst-summary", isAuthenticated, authorizeAdmin, getGSTSummary);

// Update company GST settings (admin)
router.put("/admin/company-settings", isAuthenticated, authorizeAdmin, updateCompanySettings);

// Export invoices (admin)
router.get("/admin/export", isAuthenticated, authorizeAdmin, exportInvoices);

// Cancel an invoice (admin)
router.put("/admin/:invoiceId/cancel", isAuthenticated, authorizeAdmin, cancelInvoice);

export default router;
