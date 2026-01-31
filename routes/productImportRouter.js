import express from "express";
import { importProducts } from "../controllers/productImportController.js";
import { isAdminAuthenticated } from "../middlewares/auth.js";

const router = express.Router();

// Define route for handling product imports
// POST /api/v1/product/import
router.post("/import", importProducts);

export default router;
