import { catchAsyncErrors } from "../middlewares/catchAsyncErrors.js";
import { User } from "../models/userSchema.js";
import ErrorHandler from "../middlewares/error.js";
import { generateToken } from "../utils/jwtToken.js";


export const adminRegister = catchAsyncErrors(async (req, res, next) => {
    const { firstName, lastName, email, phone, password, role } = req.body;
  
    if (!firstName || !lastName || !email || !phone || !password || !role) {
      return next(new ErrorHandler("Please fill full form!", 400));
    }
    let user = await User.findOne({ email });
    if (user) {
      return next(new ErrorHandler("User already Registered!", 400));
    }
    user = await User.create({
      firstName,
      lastName,
      email,
      phone,
      password,
      role,
    });
    generateToken(user, "User registered", 200, res);
  });
  
  export const login = catchAsyncErrors(async (req, res, next) => {
    // const { email, password, role } = req.body;
    const { email, password } = req.body;
    if (!email || !password ) {
      return next(new ErrorHandler("Please provide all Detail!", 400));
    }
  
    const user = await User.findOne({ email }).select("+password");
    if (!user) {
      return next(new ErrorHandler("Invalid Password or Email!", 400));
    }
    const isPasswordMatched = await user.comparePassword(password);
    if (!isPasswordMatched) {
      return next(new ErrorHandler("Invalid Password or Email!", 400));
    }
    // if (role !== user.role) {
    //   return next(new ErrorHandler("User with this role not found", 400));
    // }
  
    generateToken(user, "Logged in successfully!", 200, res);
  });
  
  export const logout = catchAsyncErrors(async (req, res, next) => {
    res
      .status(200)
      .cookie("adminToken", "", {
        httpOnly: true, 
        expires: new Date(Date.now()),
        secure: true, //not strictly required in localhost
        sameSite: "None", //not strictly required in localhost
      })
      .cookie("staffToken", "", {
        httpOnly: true,
        expires: new Date(Date.now()),
        secure: true, // not strictly required in localhost
        sameSite: "None", // not strictly required in localhost
      })
      .json({
        success: true,
        message: "Logged out successfully!",
      });
  });
  
  export const getUserDetails = catchAsyncErrors(async (req, res, next) => {
    const user = req.user;
    res.status(200).json({
      success: true,
      user,
    });
  });