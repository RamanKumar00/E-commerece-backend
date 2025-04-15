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
    enum: [
      "Personal Care Products",
      "Food & Beverages",
      "Home Care Products",
      "Baby Care Products",
      "Health Care Products",
    ],
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
