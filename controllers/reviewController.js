import { catchAsyncError } from "../middlewares/catchAsyncError.js";
import ErrorHandler from "../middlewares/error.js";
import { Review } from "../models/reviewSchema.js";
import { Product } from "../models/productSchema.js";
import { Order } from "../models/orderSchema.js";

// @desc    Create a new review
// @route   POST /api/v1/review
// @access  Private (Verified Buyers Only)
export const createReview = catchAsyncError(async (req, res, next) => {
  const { productId, orderId, rating, title, comment } = req.body;
  const userId = req.user._id;

  // Validate required fields
  if (!productId || !orderId || !rating || !comment) {
    return next(new ErrorHandler("Product ID, Order ID, Rating, and Comment are required", 400));
  }

  // Validate rating
  if (rating < 1 || rating > 5) {
    return next(new ErrorHandler("Rating must be between 1 and 5", 400));
  }

  // Check if product exists
  const product = await Product.findById(productId);
  if (!product) {
    return next(new ErrorHandler("Product not found", 404));
  }

  // Verify the order exists and belongs to user
  const order = await Order.findOne({
    _id: orderId,
    user: userId,
    orderStatus: "Delivered" // Only delivered orders can be reviewed
  });

  if (!order) {
    return next(new ErrorHandler("You can only review products from your delivered orders", 403));
  }

  // Check if the product is in the order
  const productInOrder = order.orderItems.some(
    item => item.product.toString() === productId
  );

  if (!productInOrder) {
    return next(new ErrorHandler("This product is not in your order", 403));
  }

  // Check if user already reviewed this product
  const existingReview = await Review.findOne({ user: userId, product: productId });
  if (existingReview) {
    return next(new ErrorHandler("You have already reviewed this product", 400));
  }

  // Create review
  const review = await Review.create({
    user: userId,
    product: productId,
    order: orderId,
    rating,
    title: title || "",
    comment,
    isVerifiedPurchase: true
  });

  // Populate user info
  await review.populate("user", "shopName email");

  res.status(201).json({
    success: true,
    message: "Review submitted successfully",
    review
  });
});

// @desc    Get reviews for a product
// @route   GET /api/v1/review/product/:productId
// @access  Public
export const getProductReviews = catchAsyncError(async (req, res, next) => {
  const { productId } = req.params;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const sortBy = req.query.sortBy || "createdAt"; // createdAt, rating, helpfulCount
  const sortOrder = req.query.sortOrder === "asc" ? 1 : -1;
  const filterRating = req.query.rating ? parseInt(req.query.rating) : null;

  // Build query
  const query = {
    product: productId,
    status: "approved"
  };

  if (filterRating) {
    query.rating = filterRating;
  }

  const skip = (page - 1) * limit;

  // Get reviews with pagination
  const reviews = await Review.find(query)
    .populate("user", "shopName email")
    .sort({ [sortBy]: sortOrder })
    .skip(skip)
    .limit(limit);

  const totalReviews = await Review.countDocuments(query);

  // Get average rating and distribution
  const ratingStats = await Review.calculateAverageRating(productId);

  res.status(200).json({
    success: true,
    reviews,
    pagination: {
      currentPage: page,
      totalPages: Math.ceil(totalReviews / limit),
      totalReviews,
      hasMore: page * limit < totalReviews
    },
    ratingStats
  });
});

// @desc    Get user's reviews
// @route   GET /api/v1/review/my-reviews
// @access  Private
export const getMyReviews = catchAsyncError(async (req, res, next) => {
  const userId = req.user._id;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;

  const skip = (page - 1) * limit;

  const reviews = await Review.find({ user: userId })
    .populate("product", "productName image price")
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  const totalReviews = await Review.countDocuments({ user: userId });

  res.status(200).json({
    success: true,
    reviews,
    pagination: {
      currentPage: page,
      totalPages: Math.ceil(totalReviews / limit),
      totalReviews
    }
  });
});

// @desc    Update a review
// @route   PUT /api/v1/review/:reviewId
// @access  Private (Owner Only)
export const updateReview = catchAsyncError(async (req, res, next) => {
  const { reviewId } = req.params;
  const { rating, title, comment } = req.body;
  const userId = req.user._id;

  const review = await Review.findById(reviewId);

  if (!review) {
    return next(new ErrorHandler("Review not found", 404));
  }

  // Check ownership
  if (review.user.toString() !== userId.toString()) {
    return next(new ErrorHandler("You can only edit your own reviews", 403));
  }

  // Update fields
  if (rating) {
    if (rating < 1 || rating > 5) {
      return next(new ErrorHandler("Rating must be between 1 and 5", 400));
    }
    review.rating = rating;
  }
  if (title !== undefined) review.title = title;
  if (comment) review.comment = comment;

  review.isEdited = true;
  review.editedAt = new Date();

  await review.save();

  res.status(200).json({
    success: true,
    message: "Review updated successfully",
    review
  });
});

// @desc    Delete a review
// @route   DELETE /api/v1/review/:reviewId
// @access  Private (Owner or Admin)
export const deleteReview = catchAsyncError(async (req, res, next) => {
  const { reviewId } = req.params;
  const userId = req.user._id;
  const userRole = req.user.role;

  const review = await Review.findById(reviewId);

  if (!review) {
    return next(new ErrorHandler("Review not found", 404));
  }

  // Check ownership or admin
  if (review.user.toString() !== userId.toString() && userRole !== "Admin") {
    return next(new ErrorHandler("You can only delete your own reviews", 403));
  }

  await Review.findByIdAndDelete(reviewId);

  res.status(200).json({
    success: true,
    message: "Review deleted successfully"
  });
});

// @desc    Mark review as helpful
// @route   POST /api/v1/review/:reviewId/helpful
// @access  Private
export const markReviewHelpful = catchAsyncError(async (req, res, next) => {
  const { reviewId } = req.params;
  const userId = req.user._id;

  const review = await Review.findById(reviewId);

  if (!review) {
    return next(new ErrorHandler("Review not found", 404));
  }

  // Check if user already marked this review as helpful
  const alreadyMarked = review.helpfulBy.includes(userId);

  if (alreadyMarked) {
    // Remove helpful vote
    review.helpfulBy = review.helpfulBy.filter(
      id => id.toString() !== userId.toString()
    );
    review.helpfulCount = Math.max(0, review.helpfulCount - 1);
  } else {
    // Add helpful vote
    review.helpfulBy.push(userId);
    review.helpfulCount += 1;
  }

  await review.save();

  res.status(200).json({
    success: true,
    message: alreadyMarked ? "Helpful vote removed" : "Marked as helpful",
    helpfulCount: review.helpfulCount,
    isHelpful: !alreadyMarked
  });
});

// @desc    Get average rating for a product
// @route   GET /api/v1/review/rating/:productId
// @access  Public
export const getProductRating = catchAsyncError(async (req, res, next) => {
  const { productId } = req.params;

  const ratingStats = await Review.calculateAverageRating(productId);

  res.status(200).json({
    success: true,
    ...ratingStats
  });
});

// ==================== ADMIN ROUTES ====================

// @desc    Get all reviews (Admin)
// @route   GET /api/v1/review/admin/all
// @access  Admin
export const getAllReviewsAdmin = catchAsyncError(async (req, res, next) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const status = req.query.status; // pending, approved, rejected, spam
  const rating = req.query.rating ? parseInt(req.query.rating) : null;
  const productId = req.query.productId;
  const sortBy = req.query.sortBy || "createdAt";
  const sortOrder = req.query.sortOrder === "asc" ? 1 : -1;

  // Build query
  const query = {};
  if (status) query.status = status;
  if (rating) query.rating = rating;
  if (productId) query.product = productId;

  const skip = (page - 1) * limit;

  const reviews = await Review.find(query)
    .populate("user", "shopName email phone")
    .populate("product", "productName image price")
    .sort({ [sortBy]: sortOrder })
    .skip(skip)
    .limit(limit);

  const totalReviews = await Review.countDocuments(query);

  // Get status counts
  const statusCounts = await Review.aggregate([
    { $group: { _id: "$status", count: { $sum: 1 } } }
  ]);

  res.status(200).json({
    success: true,
    reviews,
    pagination: {
      currentPage: page,
      totalPages: Math.ceil(totalReviews / limit),
      totalReviews
    },
    statusCounts: statusCounts.reduce((acc, { _id, count }) => {
      acc[_id] = count;
      return acc;
    }, {})
  });
});

// @desc    Moderate a review (approve/reject/spam)
// @route   PUT /api/v1/review/admin/:reviewId/moderate
// @access  Admin
export const moderateReview = catchAsyncError(async (req, res, next) => {
  const { reviewId } = req.params;
  const { status, moderationNote } = req.body;
  const adminId = req.user._id;

  if (!["approved", "rejected", "spam"].includes(status)) {
    return next(new ErrorHandler("Invalid status. Use: approved, rejected, or spam", 400));
  }

  const review = await Review.findById(reviewId);

  if (!review) {
    return next(new ErrorHandler("Review not found", 404));
  }

  review.status = status;
  review.moderationNote = moderationNote || "";
  review.moderatedBy = adminId;
  review.moderatedAt = new Date();

  await review.save();

  res.status(200).json({
    success: true,
    message: `Review ${status} successfully`,
    review
  });
});

// @desc    Get review analytics (Admin)
// @route   GET /api/v1/review/admin/analytics
// @access  Admin
export const getReviewAnalytics = catchAsyncError(async (req, res, next) => {
  // Overall stats
  const totalReviews = await Review.countDocuments();
  const approvedReviews = await Review.countDocuments({ status: "approved" });
  const pendingReviews = await Review.countDocuments({ status: "pending" });

  // Average rating across all products
  const avgRatingResult = await Review.aggregate([
    { $match: { status: "approved" } },
    { $group: { _id: null, avgRating: { $avg: "$rating" } } }
  ]);
  const overallAvgRating = avgRatingResult[0]?.avgRating || 0;

  // Top rated products
  const topRatedProducts = await Review.aggregate([
    { $match: { status: "approved" } },
    {
      $group: {
        _id: "$product",
        avgRating: { $avg: "$rating" },
        totalReviews: { $sum: 1 }
      }
    },
    { $match: { totalReviews: { $gte: 1 } } },
    { $sort: { avgRating: -1 } },
    { $limit: 10 },
    {
      $lookup: {
        from: "products",
        localField: "_id",
        foreignField: "_id",
        as: "product"
      }
    },
    { $unwind: "$product" },
    {
      $project: {
        productId: "$_id",
        productName: "$product.productName",
        productImage: "$product.image",
        avgRating: { $round: ["$avgRating", 1] },
        totalReviews: 1
      }
    }
  ]);

  // Low rated products
  const lowRatedProducts = await Review.aggregate([
    { $match: { status: "approved" } },
    {
      $group: {
        _id: "$product",
        avgRating: { $avg: "$rating" },
        totalReviews: { $sum: 1 }
      }
    },
    { $match: { totalReviews: { $gte: 1 } } },
    { $sort: { avgRating: 1 } },
    { $limit: 10 },
    {
      $lookup: {
        from: "products",
        localField: "_id",
        foreignField: "_id",
        as: "product"
      }
    },
    { $unwind: "$product" },
    {
      $project: {
        productId: "$_id",
        productName: "$product.productName",
        productImage: "$product.image",
        avgRating: { $round: ["$avgRating", 1] },
        totalReviews: 1
      }
    }
  ]);

  // Rating distribution
  const ratingDistribution = await Review.aggregate([
    { $match: { status: "approved" } },
    { $group: { _id: "$rating", count: { $sum: 1 } } },
    { $sort: { _id: 1 } }
  ]);

  // Recent reviews
  const recentReviews = await Review.find({ status: "approved" })
    .populate("user", "shopName")
    .populate("product", "productName image")
    .sort({ createdAt: -1 })
    .limit(5);

  res.status(200).json({
    success: true,
    analytics: {
      totalReviews,
      approvedReviews,
      pendingReviews,
      overallAvgRating: Math.round(overallAvgRating * 10) / 10,
      ratingDistribution: ratingDistribution.reduce((acc, { _id, count }) => {
        acc[_id] = count;
        return acc;
      }, { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }),
      topRatedProducts,
      lowRatedProducts,
      recentReviews
    }
  });
});

// @desc    Check if user can review a product
// @route   GET /api/v1/review/can-review/:productId
// @access  Private
export const canReviewProduct = catchAsyncError(async (req, res, next) => {
  const { productId } = req.params;
  const userId = req.user._id;

  // Check if already reviewed
  const existingReview = await Review.findOne({ user: userId, product: productId });
  if (existingReview) {
    return res.status(200).json({
      success: true,
      canReview: false,
      reason: "already_reviewed",
      existingReview
    });
  }

  // Check if user has a delivered order with this product
  const eligibleOrder = await Order.findOne({
    user: userId,
    orderStatus: "Delivered",
    "orderItems.product": productId
  });

  if (!eligibleOrder) {
    return res.status(200).json({
      success: true,
      canReview: false,
      reason: "not_purchased"
    });
  }

  res.status(200).json({
    success: true,
    canReview: true,
    orderId: eligibleOrder._id
  });
});
