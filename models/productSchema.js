import mongoose from "mongoose";

const productSchema = new mongoose.Schema({
  productName: {
    type: String,
    required: true,
  },
  image: {
    public_id: String,
    url: String,
  },
  pexelsPhotoId: { type: Number },
  description: {
    type: String,
    required: true,
  },
  stock: {
    type: Number,
    required: true,
  },
  price: {
    type: String,
    required: true,
  },
  subCategory: {
    type: String,
    required: true,
  },
  parentCategory: {
    type: String,
    required: true,
  },
  // B2B Retailer Fields
  b2bMinQty: {
    type: Number,
    default: 6, 
  },
  b2bPrice: {
    type: Number, 
  },
  isB2BAvailable: {
    type: Boolean,
    default: true,
  },
  
  // New Fields for Bulk Import & Enhanced Catalog
  sku: {
    type: String,
    unique: true,
    sparse: true // Allows null/undefined if not set initially
  },
  costPrice: {
    type: Number, // Purchase price
  },
  discount: {
    type: Number, // Percentage or fixed amount
    default: 0
  },
  unit: {
    type: String, // e.g., 'kg', 'pcs', 'liter'
    default: 'pcs'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  importedFromExcel: {
    type: Boolean,
    default: false
  },

  rating_reviews: [
    {
      rating: {
        type: Number,
        required: true,
        enum: [1, 2, 3, 4, 5],
      },
      review: { type: String },
      images: [
        {
          public_id: String,
          url: String,
        },
      ],
    },
  ],
});

export const Product = mongoose.model("Product", productSchema);
