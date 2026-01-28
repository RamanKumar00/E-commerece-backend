import { catchAsyncErrors } from "../middlewares/catchAsyncErrors.js";
import { User } from "../models/userSchema.js";
import { Product } from "../models/productSchema.js";
import ErrorHandler from "../middlewares/error.js";

// Add to Wishlist
export const addToWishlist = catchAsyncErrors(async (req, res, next) => {
  const { productId } = req.body;
  if (!productId) {
    return next(new ErrorHandler("Product ID is required", 400));
  }

  const user = await User.findById(req.user._id);
  const product = await Product.findById(productId);

  if (!product) {
    return next(new ErrorHandler("Product not found", 404));
  }

  const isAlreadyInWishlist = user.wishlist.find(
    (item) => item.product.toString() === productId
  );

  if (isAlreadyInWishlist) {
    return next(new ErrorHandler("Product already in wishlist", 400));
  }

  user.wishlist.push({ product: productId });
  await user.save();

  res.status(200).json({
    success: true,
    message: "Added to wishlist",
    wishlist: user.wishlist
  });
});

// Remove from Wishlist
export const removeFromWishlist = catchAsyncErrors(async (req, res, next) => {
  const { productId } = req.params; // Using params for cleaner API: DELETE /wishlist/:productId
  
  const user = await User.findById(req.user._id);

  const initialLength = user.wishlist.length;
  user.wishlist = user.wishlist.filter(
    (item) => item.product.toString() !== productId
  );

  if (initialLength === user.wishlist.length) {
     // Item was not in wishlist, but operation is idempotent, so maybe just success?
     // Or 404? Let's return success.
  }

  await user.save();

  res.status(200).json({
    success: true,
    message: "Removed from wishlist",
    wishlist: user.wishlist
  });
});

// Get Wishlist
export const getWishlist = catchAsyncErrors(async (req, res, next) => {
  const user = await User.findById(req.user._id).populate("wishlist.product");

  res.status(200).json({
    success: true,
    wishlist: user.wishlist
  });
});
