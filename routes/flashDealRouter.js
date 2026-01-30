import express from "express";
import { getActiveFlashDeal, updateFlashDeal } from "../controllers/flashDealController.js";
import { isAuthenticated, authorizedRoles } from "../middlewares/auth.js";

const router = express.Router();

router.get("/active", getActiveFlashDeal);
router.put("/update", isAuthenticated, authorizedRoles("admin"), updateFlashDeal); 
// Note: Using PUT conceptually as "update current state", though implementation creates new doc.

export default router;
