import { catchAsyncErrors } from "../middlewares/catchAsyncErrors.js";
import ErrorHandler from "../middlewares/error.js";
import { Banner } from "../models/bannerSchema.js";
import { Category } from "../models/categorySchema.js";
import { Product } from "../models/productSchema.js";
import cloudinary from "cloudinary";

//Product
export const newProduct = catchAsyncErrors(async (req, res, next) => {
  const { productName, description, stock, price, category } = req.body;
  if (!productName || !description || !stock || !price || !category) {
    return next(new ErrorHandler("Please fill all fields!", 400));
  }
  const product = await Product.create({
    productName,
    description,
    stock,
    price,
    category,
  });

  res.status(200).json({
    success: true,
    message: `Product Created Successfully`,
    product,
  });
});

export const getProduct = catchAsyncErrors(async (req, res, next) => {
  const { productId } = req.query;

  const product = await Product.findOne({ _id: productId });

  res.status(200).json({
    success: true,
    product,
  });
});

// Banner
export const addBannerImages = catchAsyncErrors(async (req, res, next) => {
  if (!req.files || Object.keys(req.files).length === 0) {
    return next(new ErrorHandler("Images are Required!", 400));
  }
  const { bannerImage } = req.files;
  const allowedFormats = ["image/png", "image/jpeg", "image/webp"];
  if (!bannerImage.mimetype || !allowedFormats.includes(bannerImage.mimetype)) {
    return next(new ErrorHandler("File format not supported!", 400));
  }

  const cloudinaryResponse = await cloudinary.uploader.upload(
    bannerImage.tempFilePath
  );
  if (!cloudinaryResponse || cloudinaryResponse.error) {
    console.error(
      "Cloudinary Error: ",
      cloudinaryResponse.error || "Unknown Cloudinary Error"
    );
    return next(new ErrorHandler("Failed To Upload Image To Cloudinary", 500));
  }

  const image = await Banner.create({
    bannerImage: {
      public_id: cloudinaryResponse.public_id,
      url: cloudinaryResponse.secure_url,
    },
  });
  res.status(200).json({
    success: true,
    image,
  });
});

export const removeABannerImage = catchAsyncErrors(async (req, res, next) => {
  const { publicId } = req.query;

  if (!publicId) {
    return next(new ErrorHandler("publicId is required", 400));
  }

  const result = await cloudinary.uploader.destroy(publicId);

  if (result.result !== "ok") {
    return next(
      new ErrorHandler("Failed to delete image from Cloudinary", 500)
    );
  }

  const bannerDoc = await Banner.findOneAndDelete({
    "bannerImage.public_id": publicId,
  });
  if (!bannerDoc) {
    return next(new ErrorHandler("Failed to delete Image from MongoDB", 500));
  }
  res.status(200).json({
    success: true,
    message: "Image deleted successfully",
  });
});

// HomeScreen Data
export const getHomeScreenData = catchAsyncErrors(async (req, res, next) => {
  const bannerImages = await Banner.find();
  const categories = await Category.find();
  const allProducts = await Product.find();
  res.status(200).json({
    success: true,
    homeScreenData: {
      bannerImages,
      categories,
      allProducts,
    },
  });
});

// homescreen contains:
// 1. bannerImages
// 2. categories
// 3. all products
