import express from "express";
import { addToWishlist, removeFromWishlist, getWishlist } from "../controllers/wishlistController.js";
import { isAuthenticated } from "../middlewares/auth.js";

const router = express.Router();

router.post("/add", isAuthenticated, addToWishlist);
router.delete("/remove/:productId", isAuthenticated, removeFromWishlist);
router.get("/my", isAuthenticated, getWishlist);

export default router;
