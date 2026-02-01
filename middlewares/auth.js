import jwt from "jsonwebtoken";
import { User } from "../models/userSchema.js";
import { catchAsyncErrors } from "../middlewares/catchAsyncErrors.js";
import ErrorHandler from "../middlewares/error.js";

export const isAdminAuthenticated = catchAsyncErrors(async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return next(new ErrorHandler("User not authenticated!", 401));
  }

  const token = authHeader.split(" ")[1]; // ✅ Extract token after "Bearer "

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);
    req.user = await User.findById(decoded.id);
   
    if (!req.user) {
      return next(new ErrorHandler("User not found!", 404));
    }
    if(req.user.role !="Admin"){
      return next(new ErrorHandler("Not Authorized, You are not Admin!", 403));
    }
    next();
  } catch (error) {
    return next(new ErrorHandler("Invalid token!", 401));
  }
});


export const isAuthenticated = catchAsyncErrors(async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return next(new ErrorHandler("User not authenticated!", 401));
  }

  const token = authHeader.split(" ")[1]; // ✅ Extract token after "Bearer "

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);
    req.user = await User.findById(decoded.id);
   
    if (!req.user) {
      return next(new ErrorHandler("User not found!", 404));
    }
    
    next();
  } catch (error) {
    return next(new ErrorHandler("Invalid token!", 401));
  }
});

// ✅ Add authorizedRoles middleware
export const authorizedRoles = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return next(
        new ErrorHandler(
          `User with role ${req.user.role} is not authorized to access this resource!`,
          403
        )
      );
    }
    next();
  };
};

export const authorizeAdmin = authorizedRoles("Admin");
