import cloudinary from "cloudinary";
import { catchAsyncErrors } from "../middlewares/catchAsyncErrors.js";
import ErrorHandler from "../middlewares/error.js";
import { Category } from "../models/categorySchema.js";

// Categories
export const addNewCategory = catchAsyncErrors(async (req, res, next) => {
  if (!req.files || Object.keys(req.files).length === 0) {
    return next(new ErrorHandler("Category Image Required!", 400));
  }
  
  // Robust field handling
  const categoryImage = req.files.categoryImage || req.files.image || req.files.doc;
  const categoryName = req.body.categoryName || req.body.category;

  const allowedFormats = ["image/png", "image/jpeg", "image/webp"];
  if (
    !categoryImage ||
    !categoryImage.mimetype ||
    !allowedFormats.includes(categoryImage.mimetype)
  ) {
    return next(new ErrorHandler("File format not supported!", 400));
  }

  if (!categoryName) {
    return next(new ErrorHandler("Please provide category name!", 400));
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
      new ErrorHandler("Failed To Upload Category Image To Cloudinary", 500)
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

export const getCategories = catchAsyncErrors(async (req, res, next) => {
  const categories = await Category.find();

  res.status(200).json({
    success: true,
    categories,
  });
});

// 
// 
// 
//
//SubCategories
export const addNewSubCategory = catchAsyncErrors(async (req, res, next) => {
  if (!req.files || Object.keys(req.files).length === 0) {
    return next(new ErrorHandler("Subcategory image is required!", 400));
  }

  const { subCategoryImage } = req.files;
  const { subCategoryName, categoryName } = req.body;

  const allowedFormats = ["image/png", "image/jpeg", "image/webp"];
  if (
    !subCategoryImage.mimetype ||
    !allowedFormats.includes(subCategoryImage.mimetype)
  ) {
    return next(new ErrorHandler("File format not supported!", 400));
  }

  if (!subCategoryImage || !subCategoryName || !categoryName) {
    return next(new ErrorHandler("Please provide full details!", 400));
  }

  // Check if the subcategory already exists inside the category
  const category = await Category.findOne({
    categoryName,
    "subCategories.subCategoryName": subCategoryName,
  });

  if (category) {
    return next(
      new ErrorHandler(
        `Subcategory '${subCategoryName}' already exists in '${categoryName}'`,
        400
      )
    );
  }

  // Find the category to update
  const categoryToUpdate = await Category.findOne({ categoryName });

  if (!categoryToUpdate) {
    return next(new ErrorHandler("Category not found!", 404));
  }

  // Upload to Cloudinary
  const cloudinaryResponse = await cloudinary.uploader.upload(
    subCategoryImage.tempFilePath
  );

  if (!cloudinaryResponse || cloudinaryResponse.error) {
    console.error(
      "Cloudinary Error: ",
      cloudinaryResponse.error || "Unknown Cloudinary Error"
    );
    return next(
      new ErrorHandler("Failed to upload subcategory image to Cloudinary", 500)
    );
  }

  // Push new subcategory to the category
  categoryToUpdate.subCategories.push({
    subCategoryName,
    subCategoryImage: {
      public_id: cloudinaryResponse.public_id,
      url: cloudinaryResponse.secure_url,
    },
  });

  await categoryToUpdate.save();

  res.status(200).json({
    success: true,
    message: `Subcategory '${subCategoryName}' added to ${categoryName} category successfully.`,
  });
});

// export const removeASubCategory = catchAsyncErrors(async (req, res, next) => {
//     const { subCategoryPublicId, subCategoryId, categoryId } = req.body;
  
//     if (!subCategoryPublicId || !subCategoryId || !categoryId) {
//       return next(new ErrorHandler("Please fill all fields", 400));
//     }
//     // //first find the subcategor
//     // const subCat =  await Category.find({"subCategories._id": subCategoryId})
//     // if (!subCat || subCat.length === 0) {
//     //     return next(new ErrorHandler("This subcategory doesn't exist", 400));
//     //   }
      
  
//     // 1. Remove image from Cloudinary
//     const result = await cloudinary.uploader.destroy(subCategoryPublicId);
//     if (result.result !== "ok") {
//       return next(
//         new ErrorHandler(
//           `Failed to delete image from Cloudinary. Error: ${result.result}`,
//           500
//         )
//       );
//     }
  
//     // 2. Remove subcategory from the array using $pull
//     const updatedCategory = await Category.findByIdAndUpdate(
//       categoryId,
//       {
//         $pull: {
//           subCategories: {
//             _id: subCategoryId,
//           },
//         },
//       },
//       { new: true }
//     );
  
//     if (!updatedCategory) {
//       return next(new ErrorHandler("Failed to remove subcategory", 500));
//     }
  
//     res.status(200).json({
//       success: true,
//       message: `Subcategory removed successfully.`,
//       category: updatedCategory,
//     });
//   });
  

export const getSubCategoriesOfCategory = catchAsyncErrors(
  async (req, res, next) => {
    const { categoryName } = req.query;
    const subCategories = await Category.find({ categoryName });

    res.status(200).json({
      success: true,
      subCategories,
    });
  }
);
