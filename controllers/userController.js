import { catchAsyncErrors } from "../middlewares/catchAsyncErrors.js";
import { User } from "../models/userSchema.js";
import ErrorHandler from "../middlewares/error.js";
import { generateToken } from "../utils/jwtToken.js";
import { sendEmail } from "../utils/sendEmail.js";

export const sendOTPtoVerifyEmail = catchAsyncErrors(async (req, res, next) => {
  const { email } = req.body;
  const otp = Math.floor(100000 + Math.random() * 900000);
  const subject = "Change Your Password - Aman Enterprises";
  const message = `Your OTP to generate password is: ${otp} \n Valid for 10 minutes only`;

  if (!email) {
    return res.status(400).json({ error: "All fields are required!" });
  }

  const mailSent = await sendEmail(email, subject, message);
  if (mailSent === false) {
    return next(new ErrorHandler("Failed to send email!", 400));
  }

  // Store OTP and expiration time (10 minutes from now)
  const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);
  await User.findOneAndUpdate(
    { email: email }, // Find user by email
    {
      $set: {
        loginOtp: otp,
        loginOtpExpiry: otpExpiry,
      },
    }, // Update the specific field
    { new: true, runValidators: true } // Return updated document & validate changes
  );

  res.status(200).json({
    success: true,
    message: `Email sent successfully to ${email}`,
  });
});

export const verifyOtpToVerifyEmail = catchAsyncErrors(
  async (req, res, next) => {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return next(new ErrorHandler("Email and OTP are required!", 400));
    }

    // Find user with matching email and OTP
    const user = await User.findOne({ email, loginOtp: otp });

    if (!user) {
      return next(new ErrorHandler("Invalid OTP or email!", 400));
    }

    // Check if OTP is expired
    if (user.loginOtpExpiry < new Date()) {
      return next(new ErrorHandler("OTP has expired! Request a new one.", 400));
    }

    res.status(200).json({
      success: true,
      message: "Email verified successfully. ",
    });
  }
);

export const userRegister = catchAsyncErrors(async (req, res, next) => {
  const {
    shopName,
    phone,
    email,
    address,
    pincode,
    state,
    city,
    role,
    password,
  } = req.body;

  if (
    !shopName ||
    !phone ||
    !email ||
    !address ||
    !pincode ||
    !state ||
    !city ||
    !role ||
    !password
  ) {
    return next(new ErrorHandler("Please fill full form!", 400));
  }
  
  // Security Check: Admin Registration
  if (role === "Admin") {
      const secretKey = process.env.ADMIN_SECRET_KEY || "aman_admin_secret_2026"; // Fallback for dev/demo
      if (req.body.adminSecretKey !== secretKey) {
          return next(new ErrorHandler("Unauthorized: Invalid Admin Secret Key!", 403));
      }
  }

  let user = await User.findOne({ phone });
  if (user) {
    return next(new ErrorHandler("User already Registered!", 400));
  }
  user = await User.create({
    shopName,
    phone,
    email,
    address,
    pincode,
    state,
    city,
    role, // Now safe as we verified secret for Admin
    password,
  });
  generateToken(user, "User registered", 200, res);
});

export const login = catchAsyncErrors(async (req, res, next) => {
  // const { email, password, role } = req.body;
  const { phone, password } = req.body;
  if (!phone || !password) {
    return next(new ErrorHandler("Please Provide correct Credential", 400));
  }

  const user = await User.findOne({ phone }).select("+password");
  if (!user) {
    return next(new ErrorHandler("Invalid Password or Phone Number!", 400));
  }
  const isPasswordMatched = await user.comparePassword(password);
  if (!isPasswordMatched) {
    return next(new ErrorHandler("Invalid Password or Phone Number!", 400));
  }
  // if (role !== user.role) {
  //   return next(new ErrorHandler("User with this role not found", 400));
  // }

  generateToken(user, "Logged in successfully!", 200, res);
});

export const getUserDetails = catchAsyncErrors(async (req, res, next) => {
  const user = req.user;
  res.status(200).json({
    success: true,
    user,
  });
});

export const sendOTPtoGeneratePassword = catchAsyncErrors(
  async (req, res, next) => {
    const { email } = req.body;
    const otp = Math.floor(100000 + Math.random() * 900000);
    const subject = "Change Your Password - Aman Enterprises";
    const message = `Your OTP to generate password is: ${otp} \n Valid for 10 minutes only`;

    if (!email) {
      return res.status(400).json({ error: "All fields are required!" });
    }

    const mailSent = await sendEmail(email, subject, message);
    if (mailSent === false) {
      return next(new ErrorHandler("Failed to send email!", 400));
    }

    // Store OTP and expiration time (10 minutes from now)
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);
    await User.findOneAndUpdate(
      { email: email }, // Find user by email
      {
        $set: {
          passwordRecoveryOtp: otp,
          passwordRecoveryOtpExpiry: otpExpiry,
        },
      }, // Update the specific field
      { new: true, runValidators: true } // Return updated document & validate changes
    );

    res.status(200).json({
      success: true,
      message: `Email sent successfully to ${email}`,
    });
  }
);

export const verifyOtpToGeneratePassword = catchAsyncErrors(
  async (req, res, next) => {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return next(new ErrorHandler("Email and OTP are required!", 400));
    }

    // Find user with matching email and OTP
    const user = await User.findOne({ email, passwordRecoveryOtp: otp });

    if (!user) {
      return next(new ErrorHandler("Invalid OTP or email!", 400));
    }

    // Check if OTP is expired
    if (user.passwordRecoveryOtpExpiry < new Date()) {
      return next(new ErrorHandler("OTP has expired! Request a new one.", 400));
    }

    res.status(200).json({
      success: true,
      message: "OTP verified successfully. You can now reset your password.",
    });
  }
);

export const createNewPassword = catchAsyncErrors(async (req, res, next) => {
  const { email, otp, newPassword } = req.body;

  if (!email || !otp || !newPassword) {
    return next(
      new ErrorHandler("Email, OTP, and new password are required!", 400)
    );
  }

  // Find user with matching email and OTP, and check if OTP is still valid
  const user = await User.findOne({
    email,
    passwordRecoveryOtp: otp,
    passwordRecoveryOtpExpiry: { $gt: Date.now() }, // ✅ Ensure OTP is not expired
  });

  if (!user) {
    return next(new ErrorHandler("Invalid or expired OTP!", 400));
  }

  user.password = newPassword;

  // ✅ Clear OTP fields after reset
  user.passwordRecoveryOtp = undefined;
  user.passwordRecoveryOtpExpiry = undefined;

  // ✅ Use `await user.save()` to ensure password is updated
  await user.save({ validateBeforeSave: false });

  res.status(200).json({
    success: true,
    message: "Password reset successfully!",
  });
});

export const updateLanguage = catchAsyncErrors(async (req, res, next) => {
  const { language } = req.body;
  if (!language) return next(new ErrorHandler("Language code required!", 400));
  
  const user = await User.findById(req.user._id);
  user.language = language;
  await user.save();
  
  res.status(200).json({
    success: true,
    message: req.t('success_language_update'),
    language: user.language
  });
});
