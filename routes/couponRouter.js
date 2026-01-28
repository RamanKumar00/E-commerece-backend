import express from "express";
import { 
  createCoupon, 
  getAllCoupons, 
  getActiveCoupons, 
  applyCoupon, 
  deleteCoupon 
} from "../controllers/couponController.js";
import { isAuthenticated, isAdminAuthenticated } from "../middlewares/auth.js"; // Assuming authmiddleware exists

const router = express.Router();

router.post("/new", isAuthenticated, isAdminAuthenticated, createCoupon);
router.get("/all", isAuthenticated, isAdminAuthenticated, getAllCoupons);
router.get("/active", isAuthenticated, getActiveCoupons); // Public/User
router.post("/apply", isAuthenticated, applyCoupon); // Check validity
router.delete("/:id", isAuthenticated, isAdminAuthenticated, deleteCoupon);

export default router;
