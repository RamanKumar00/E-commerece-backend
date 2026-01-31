import express from "express";
import { importProducts } from "../controllers/productImportController.js";
import { isAdminAuthenticated } from "../middlewares/auth.js";

const router = express.Router();

// Define route for handling product imports
// POST /api/v1/product/import
router.post("/import", isAdminAuthenticated, importProducts); 

// Note: Removed isAuthenticated and isAdmin temporarily for easier testing if needed, 
// strictly you should add: router.post("/import", isAuthenticated, isAdmin, importProducts);
// Since I haven't verified the auth middleware paths, I'll refer to them if they exist effectively.
// Let me verify auth middleware existence.

export default router;
