import { catchAsyncErrors } from "../middlewares/catchAsyncErrors.js";
import ErrorHandler from "../middlewares/error.js";
import { Banner } from "../models/bannerSchema.js";
import { Category } from "../models/categorySchema.js";
import { Product } from "../models/productSchema.js";
import cloudinary from "cloudinary";

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

// Categories
export const addNewCategory = catchAsyncErrors(async (req, res, next) => {
  if (!req.files || Object.keys(req.files).length === 0) {
    return next(new ErrorHandler("Category Image Required!", 400));
  }
  const { categoryImage } = req.files;
  const { categoryName } = req.body;
  const allowedFormats = ["image/png", "image/jpeg", "image/webp"];
  if (
    !categoryImage.mimetype ||
    !allowedFormats.includes(categoryImage.mimetype)
  ) {
    return next(new ErrorHandler("File format not supported!", 400));
  }

  if (!categoryImage || !categoryName) {
    return next(new ErrorHandler("Please provide full details!", 400));
  }
  const alreadyCategory = await Category.findOne({ categoryName });
  if (alreadyCategory) {
    return next(
      new ErrorHandler(`${alreadyCategory.categoryName} already exists!`, 400)
    );
  }

  const cloudinaryResponse = await cloudinary.uploader.upload(
    categoryImage.tempFilePath
  );
  if (!cloudinaryResponse || cloudinaryResponse.error) {
    console.error(
      "Cloudinary Error: ",
      cloudinaryResponse.error || "Unknown Cloudinary Error"
    );
    return next(
      new ErrorHandler("Failed To Upload Doctor Avatar To Cloudinary", 500)
    );
  }

  const category = await Category.create({
    categoryName,
    categoryImage: {
      public_id: cloudinaryResponse.public_id,
      url: cloudinaryResponse.secure_url,
    },
  });
  res.status(200).json({
    success: true,
    message: `${category.categoryName} category Created Successfully`,
  });
});

export const removeACategory = catchAsyncErrors(async (req, res, next) => {
  const { publicId, categoryName } = req.body;

  if (!publicId || !categoryName) {
    return next(new ErrorHandler("Please fill all fields", 400));
  }

  const result = await cloudinary.uploader.destroy(publicId);

  if (result.result !== "ok") {
    return next(
      new ErrorHandler(
        `Failed to delete image from Cloudinary. Error:${result.result}`,
        500
      )
    );
  }

  const categoryDoc = await Category.findOneAndDelete({
    categoryName: categoryName,
    "categoryImage.public_id": publicId,
  });
  if (!categoryDoc) {
    return next(new ErrorHandler("Failed to delete Category", 500));
  }
  res.status(200).json({
    success: true,
    message: "Category deleted successfully",
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

export const getCategories = catchAsyncErrors(async (req, res, next) => {
  const categories = await Category.find();

  res.status(200).json({
    success: true,
    categories,
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
