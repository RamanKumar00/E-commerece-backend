import mongoose from "mongoose";

const reviewSchema = new mongoose.Schema({
  // Core fields
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Product",
    required: true
  },
  order: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Order",
    required: true // Only verified buyers can review
  },
  
  // Review content
  rating: {
    type: Number,
    required: true,
    min: 1,
    max: 5
  },
  title: {
    type: String,
    maxLength: 100,
    trim: true
  },
  comment: {
    type: String,
    required: true,
    minLength: 10,
    maxLength: 1000,
    trim: true
  },
  images: [{
    public_id: String,
    url: String
  }],
  
  // Engagement
  helpfulCount: {
    type: Number,
    default: 0
  },
  helpfulBy: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  }],
  
  // Moderation
  status: {
    type: String,
    enum: ["pending", "approved", "rejected", "spam"],
    default: "approved" // Auto-approve for now, can change to pending for moderation
  },
  moderationNote: {
    type: String
  },
  moderatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  },
  moderatedAt: {
    type: Date
  },
  
  // Flags
  isVerifiedPurchase: {
    type: Boolean,
    default: true // Since we require order ID, it's always verified
  },
  isEdited: {
    type: Boolean,
    default: false
  },
  editedAt: {
    type: Date
  }
}, { 
  timestamps: true 
});

// Compound index to prevent duplicate reviews by same user for same product
reviewSchema.index({ user: 1, product: 1 }, { unique: true });

// Indexes for efficient queries
reviewSchema.index({ product: 1, status: 1, createdAt: -1 });
reviewSchema.index({ user: 1, createdAt: -1 });
reviewSchema.index({ rating: 1 });
reviewSchema.index({ status: 1 });

// Static method to calculate average rating for a product
reviewSchema.statics.calculateAverageRating = async function(productId) {
  const stats = await this.aggregate([
    { $match: { product: productId, status: "approved" } },
    {
      $group: {
        _id: "$product",
        averageRating: { $avg: "$rating" },
        totalReviews: { $sum: 1 },
        ratingDistribution: {
          $push: "$rating"
        }
      }
    }
  ]);
  
  if (stats.length > 0) {
    // Calculate rating distribution
    const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    stats[0].ratingDistribution.forEach(r => {
      distribution[r]++;
    });
    
    return {
      averageRating: Math.round(stats[0].averageRating * 10) / 10,
      totalReviews: stats[0].totalReviews,
      ratingDistribution: distribution
    };
  }
  
  return {
    averageRating: 0,
    totalReviews: 0,
    ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
  };
};

export const Review = mongoose.model("Review", reviewSchema);
