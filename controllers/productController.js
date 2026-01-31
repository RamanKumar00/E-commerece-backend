import { catchAsyncErrors } from "../middlewares/catchAsyncErrors.js";
import ErrorHandler from "../middlewares/error.js";
import { Banner } from "../models/bannerSchema.js";
import { Category } from "../models/categorySchema.js";
import { Product } from "../models/productSchema.js";
import { fetchPexelsImages } from "../utils/pexels.js";
import cloudinary from "cloudinary";
import xlsx from "xlsx";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const excelPath = path.resolve(__dirname, "../../products.xlsx");

// Helper: Sync to Excel
export const syncToExcel = (product, action = "UPDATE") => {
  try {
    if (!fs.existsSync(excelPath)) return;

    const workbook = xlsx.readFile(excelPath);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    let data = xlsx.utils.sheet_to_json(sheet);

    if (action === "DELETE") {
      data = data.filter(row => {
          const name = (row["Item name"] || row["Product Name"] || row["Item name*"] || "").trim();
          return name.toLowerCase() !== product.productName.toLowerCase();
      });
    } else {
      // Create or Update
      let found = false;
      const newRow = {
        "Item name": product.productName,
        "Category": product.category || product.parentCategory,
        "Sub Category": product.subCategory,
        "Sale price": product.price,
        "Current stock quantity": product.stock,
        "Description": product.description,
        "Unit": "pcs", // Default
        "Discount": 0
      };

      data = data.map(row => {
        const name = (row["Item name"] || row["Product Name"] || row["Item name*"] || "").trim();
        if (name.toLowerCase() === product.productName.toLowerCase()) {
          found = true;
          // Merge updates
          return { ...row, ...newRow, "Item name": name }; // Keep original name casing if desired
        }
        return row;
      });

      if (!found && action !== "DELETE") {
        data.push(newRow);
      }
    }

    const newSheet = xlsx.utils.json_to_sheet(data);
    workbook.Sheets[sheetName] = newSheet;
    xlsx.writeFile(workbook, excelPath);
    console.log(`✅ Excel Synced: ${action} ${product.productName}`);

  } catch (error) {
    console.error("❌ Excel Sync Failed:", error);
  }
};

//Product......................................................................................
export const newProduct = catchAsyncErrors(async (req, res, next) => {
  // 1. Handle File Upload OR Pexels URL OR Auto-Fetch
  let image = null;
  let isPexels = false;
  let pexelsId = null;

  if (req.files && (req.files.image || req.files.doc)) {
    image = req.files.image || req.files.doc;
  } else if (req.body.imageUrl) {
    image = req.body.imageUrl;
    isPexels = true;
  } 

  // Auto-Fetch Logic if no image provided
  if (!image) {
    const query = `${req.body.productName} ${req.body.subCategory || req.body.category || ''}`;
    const pexelsImages = await fetchPexelsImages(query, 5);
    if (pexelsImages && pexelsImages.length > 0) {
        // Pick the first one (or random)
        const selected = pexelsImages[0];
        image = selected.url;
        pexelsId = selected.id;
        isPexels = true;
    }
  }

  if (!image) {
    return next(new ErrorHandler("Product Image Required (uploaded, url, or auto-fetch failed)!", 400));
  }
  
  const {
    productName,
    description,
    stock,
    price,
    subCategory,
    parentCategory,
    category, 
    b2bMinQty,
    b2bPrice,
    isB2BAvailable
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
        url: image 
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
    pexelsPhotoId: pexelsId,
    b2bMinQty: b2bMinQty || 6,
    b2bPrice: b2bPrice || price, // Default to regular price if not set
    isB2BAvailable: isB2BAvailable !== undefined ? isB2BAvailable : true
  });

  // Sync to Excel
  syncToExcel(product, "CREATE");

  res.status(200).json({
    success: true,
    message: `Product Created Successfully`,
    product,
  });
});

export const updateProduct = catchAsyncErrors(async (req, res, next) => {
  const { id } = req.params;
  let product = await Product.findById(id);

  if (!product) {
    return next(new ErrorHandler("Product not found", 404));
  }

  // Handle Image Update
  let image = null;
  let isPexels = false;
  let pexelsId = null;

  if (req.files && (req.files.image || req.files.doc)) {
    image = req.files.image || req.files.doc;
  } else if (req.body.imageUrl) {
    image = req.body.imageUrl;
    isPexels = true;
  }

  if (image) {
    // Delete old image from Cloudinary if it exists and isn't a pexels/dummy one
    if (product.image && product.image.public_id && !product.image.public_id.startsWith('pexels_')) {
        try {
            await cloudinary.uploader.destroy(product.image.public_id);
        } catch(err) {
            console.error("Failed to delete old image:", err);
        }
    }

    let imageData = {};

    if (isPexels) {
        imageData = {
            public_id: "pexels_image",
            url: image,
        };
        product.pexelsPhotoId = pexelsId; // pexelsId might be null if manually pasted URL, that's fine
    } else {
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

    product.image = imageData;
  }

  // Update other fields
  const {
    productName,
    description,
    stock,
    price,
    subCategory,
    parentCategory,
    category,
    b2bMinQty,
    b2bPrice,
    isB2BAvailable
  } = req.body;

  if (productName) product.productName = productName;
  if (description) product.description = description;
  if (stock) product.stock = stock;
  if (price) product.price = price;
  if (category) {
      product.subCategory = subCategory || category;
      product.parentCategory = parentCategory || category;
  }
  // ... (updateProduct logic above) ...
  if (b2bMinQty) product.b2bMinQty = b2bMinQty;
  if (b2bPrice) product.b2bPrice = b2bPrice;
  if (isB2BAvailable !== undefined) product.isB2BAvailable = isB2BAvailable;

  await product.save();

  // Sync to Excel
  syncToExcel(product, "UPDATE");

  res.status(200).json({
    success: true,
    message: "Product Updated Successfully",
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
    isActive: true, // Only active products
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

  const totalProducts = await Product.countDocuments({ isActive: true });
  const products = await Product.find({ isActive: true }).sort({ createdAt: -1, _id: -1 }).skip(skip).limit(limit);

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

  // Sync to Excel
  syncToExcel(product, "DELETE");

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

export const fixProductImages = catchAsyncErrors(async (req, res, next) => {
  // Find products with missing/empty image URLs
  const products = await Product.find({
      $or: [
          { "image": { $exists: false } },
          { "image.url": { $exists: false } },
          { "image.url": "" },
          { "image.url": null }
      ]
  });

  let fixedCount = 0;
  let errors = 0;

  for (const product of products) {
      try {
          // Construct search query
          const query = `${product.productName} ${product.category || ''}`;
          
          // Fetch from Pexels
          const pexelsImages = await fetchPexelsImages(query, 1);
          
          if (pexelsImages && pexelsImages.length > 0) {
              const selected = pexelsImages[0];
              
              product.image = {
                  public_id: `pexels_${selected.id}`,
                  url: selected.url
              };
              product.pexelsPhotoId = selected.id;
              
              await product.save({ validateBeforeSave: false });
              fixedCount++;
          }
      } catch (error) {
          console.error(`Failed to fix image for ${product.productName}:`, error);
          errors++;
      }
  }

  res.status(200).json({
      success: true,
      message: `Image Repair Complete. Found ${products.length} issues. Fixed ${fixedCount}. Failed/NoResult: ${errors}`,
      stats: {
          found: products.length,
          fixed: fixedCount,
          failed: errors
      }
  });
});
