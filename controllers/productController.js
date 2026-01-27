import { catchAsyncErrors } from "../middlewares/catchAsyncErrors.js";
import ErrorHandler from "../middlewares/error.js";
import { Banner } from "../models/bannerSchema.js";
import { Category } from "../models/categorySchema.js";
import { Product } from "../models/productSchema.js";
import { fetchPexelsImages } from "../utils/pexels.js";
import cloudinary from "cloudinary";

//Product......................................................................................
export const newProduct = catchAsyncErrors(async (req, res, next) => {
  // 1. Handle File Upload OR Pexels URL
  let image = null;
  let isPexels = false;

  if (req.files && (req.files.image || req.files.doc)) {
    image = req.files.image || req.files.doc;
  } else if (req.body.imageUrl) {
    image = req.body.imageUrl;
    isPexels = true;
  }

  if (!image) {
    return next(new ErrorHandler("Product Image Required (File or URL)!", 400));
  }
  
  const {
    productName,
    description,
    stock,
    price,
    subCategory,
    parentCategory,
    category, 
  } = req.body;

  // Flexible category handling
  const finalSubCategory = subCategory || category;
  const finalParentCategory = parentCategory || category;

  if (
    !productName ||
    !description ||
    !stock ||
    !price ||
    (!finalSubCategory && !finalParentCategory)
  ) {
    return next(new ErrorHandler("Please fill all fields!", 400));
  }
  
  let imageData = {};

  if (isPexels) {
      // Direct URL
      imageData = {
        public_id: "pexels_image",
        url: image // It's a string URL
      };
  } else {
     // File Upload
      const allowedFormats = ["image/png", "image/jpeg", "image/webp"];
      if (!image.mimetype || !allowedFormats.includes(image.mimetype)) {
        return next(new ErrorHandler("File format not supported!", 400));
      }

      const cloudinaryResponse = await cloudinary.uploader.upload(
        image.tempFilePath
      );
      
      if (!cloudinaryResponse || cloudinaryResponse.error) {
        return next(new ErrorHandler("Failed To Upload Product Image", 500));
      }
      
      imageData = {
          public_id: cloudinaryResponse.public_id,
          url: cloudinaryResponse.secure_url,
      };
  }

  const product = await Product.create({
    productName,
    image: imageData,
    description,
    stock,
    price,
    subCategory: finalSubCategory,
    parentCategory: finalParentCategory,
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

// Banner......................................................................................
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

// HomeScreen Data..............................................................................
export const searchProduct = catchAsyncErrors(async (req, res, next) => {
  const { query } = req.query;

  if (!query || query.trim() === "") {
    return res.status(400).json({
      success: false,
      message: "Query parameter is required for searching.",
    });
  }

  const regex = new RegExp(query, "i"); // case-insensitive regex

  const products = await Product.find({
    $or: [
      { productName: regex },
      { subCategory: regex },
      { parentCategory: regex },
    ],
  });

  res.status(200).json({
    success: true,
    homeScreenData: {
      allProducts: products,
    },
  });
});

export const getHomeScreenData = catchAsyncErrors(async (req, res, next) => {
  const bannerImages = await Banner.find();
  const categories = await Category.find();
  res.status(200).json({
    success: true,
    homeScreenData: {
      bannerImages,
      categories,
    },
  });
});

export const getPaginatedProducts = catchAsyncErrors(async (req, res, next) => {
  const page = parseInt(req.query.page) || 1; // Default to page 1
  const limit = 20;
  const skip = (page - 1) * limit;

  const totalProducts = await Product.countDocuments();
  const products = await Product.find().skip(skip).limit(limit);

  res.status(200).json({
    success: true,
    currentPage: page,
    totalPages: Math.ceil(totalProducts / limit),
    totalProducts,
    productsPerPage: limit,
    products,
  });
});

export const deleteProduct = catchAsyncErrors(async (req, res, next) => {
  const { id } = req.params;
  const product = await Product.findById(id);

  if (!product) {
    return next(new ErrorHandler("Product not found", 404));
  }

  if (product.image && product.image.public_id) {
    await cloudinary.uploader.destroy(product.image.public_id);
  }

  await product.deleteOne();

  res.status(200).json({
    success: true,
    message: "Product Deleted Successfully",
  });
});

export const getSuggestedImages = catchAsyncErrors(async (req, res, next) => {
    const { query } = req.query;
    if (!query) return next(new ErrorHandler("Search query required", 400));
    
    // Fetch from Pexels
    const images = await fetchPexelsImages(query, 6);
    
    res.status(200).json({
        success: true,
        images // Returns array of { url, alt, photographer }
    });
});
