import express from "express";
import { 
  createPaymentOrder, 
  verifyPayment, 
  getRazorpayKey 
} from "../controllers/paymentController.js";
import { isAuthenticated } from "../middlewares/auth.js";

const router = express.Router();

router.post("/process", isAuthenticated, createPaymentOrder);
router.post("/verify", isAuthenticated, verifyPayment);
router.get("/key", isAuthenticated, getRazorpayKey); // Frontend needs the key

export default router;
