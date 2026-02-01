import express from "express";
import {
  createReview,
  getProductReviews,
  getMyReviews,
  updateReview,
  deleteReview,
  markReviewHelpful,
  getProductRating,
  getAllReviewsAdmin,
  moderateReview,
  getReviewAnalytics,
  canReviewProduct
} from "../controllers/reviewController.js";
import { isAuthenticated, authorizeAdmin } from "../middlewares/auth.js";

const router = express.Router();

// ==================== PUBLIC ROUTES ====================
// Get reviews for a product (public)
router.get("/product/:productId", getProductReviews);

// Get average rating for a product (public)
router.get("/rating/:productId", getProductRating);

// ==================== USER ROUTES (Authenticated) ====================
// Create a new review
router.post("/", isAuthenticated, createReview);

// Get user's own reviews
router.get("/my-reviews", isAuthenticated, getMyReviews);

// Check if user can review a product
router.get("/can-review/:productId", isAuthenticated, canReviewProduct);

// Update a review
router.put("/:reviewId", isAuthenticated, updateReview);

// Delete a review
router.delete("/:reviewId", isAuthenticated, deleteReview);

// Mark review as helpful
router.post("/:reviewId/helpful", isAuthenticated, markReviewHelpful);

// ==================== ADMIN ROUTES ====================
// Get all reviews (admin)
router.get("/admin/all", isAuthenticated, authorizeAdmin, getAllReviewsAdmin);

// Moderate a review (admin)
router.put("/admin/:reviewId/moderate", isAuthenticated, authorizeAdmin, moderateReview);

// Get review analytics (admin)
router.get("/admin/analytics", isAuthenticated, authorizeAdmin, getReviewAnalytics);

export default router;
