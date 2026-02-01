import express from "express";
import { isAuthenticated, authorizeAdmin } from "../middlewares/auth.js";
import {
  downloadTemplate,
  parseUploadFile,
  executeBulkUpload,
  getProductsForPriceUpdate,
  previewPriceUpdate,
  executePriceUpdate,
  getLowStockProducts,
  parseStockFile,
  downloadStockTemplate,
  executeStockUpdate,
  manualStockUpdate
} from "../controllers/bulkProductController.js";

const router = express.Router();

// All routes require admin authentication
router.use(isAuthenticated, authorizeAdmin);

// ==================== BULK UPLOAD ====================
// Download sample template
router.get("/template/products", downloadTemplate);

// Parse and validate upload file
router.post("/upload/parse", parseUploadFile);

// Execute bulk upload
router.post("/upload/execute", executeBulkUpload);

// ==================== BULK PRICE UPDATE ====================
// Get products for price update
router.get("/price/products", getProductsForPriceUpdate);

// Preview price changes
router.post("/price/preview", previewPriceUpdate);

// Execute price update
router.post("/price/execute", executePriceUpdate);

// ==================== BULK STOCK UPDATE ====================
// Get low stock products
router.get("/stock/low", getLowStockProducts);

// Download stock update template
router.get("/template/stock", downloadStockTemplate);

// Parse stock update file
router.post("/stock/parse", parseStockFile);

// Execute stock update
router.post("/stock/execute", executeStockUpdate);

// Manual stock update (without file)
router.post("/stock/manual", manualStockUpdate);

export default router;
