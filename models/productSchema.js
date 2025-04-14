import mongoose, { mongo } from "mongoose";
import validator from "validator";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

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
    type: String,
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
    enum: ["Personal Care Products", "Food & Beverages", "Home Care Products", "Baby Care Products", "Health Care Products"],
  },
});

 
export const Product = mongoose.model("Product", productSchema);
