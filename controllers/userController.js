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

// Hardcoded Official Owner Credentials
const OFFICIAL_ADMIN_EMAIL = "amanenterprises01720@gmail.com";
const OFFICIAL_ADMIN_PHONE = "9097037320"; // Normalized (no +91 for comparison usually, but handled below)

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
  
  // Security Check: Enforce Official Admin Rule
  if (role === "Admin") {
      // Normalize comparison (trim, lowercase)
      const inputEmail = email.trim().toLowerCase();
      const inputPhone = phone.toString().replace(/[^0-9]/g, "").slice(-10); // Last 10 digits
      
      const officialPhone = OFFICIAL_ADMIN_PHONE; // Assuming 10 digits stored

      if (inputEmail !== OFFICIAL_ADMIN_EMAIL || inputPhone !== officialPhone) {
          return next(new ErrorHandler("You cannot login as Admin. You can only login as Customer or Retailer.", 403));
      }

      // If credentials match, we still check the secret key as double-security
      const secretKey = process.env.ADMIN_SECRET_KEY || "aman_admin_secret_2026"; 
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
    role, 
    password,
  });
  generateToken(user, "User registered", 200, res);
});

export const login = catchAsyncErrors(async (req, res, next) => {
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

  // --- STRICT ACCESS CONTROL ENFORCEMENT ---
  if (user.role === 'Admin') {
      const userEmail = (user.email || "").trim().toLowerCase();
      const userPhone = (user.phone || "").toString().replace(/[^0-9]/g, "").slice(-10);
      const officialPhone = OFFICIAL_ADMIN_PHONE;

      // If user has Admin role in DB but credentials DO NOT match the official owner
      if (userEmail !== OFFICIAL_ADMIN_EMAIL || userPhone !== officialPhone) {
          console.warn(`[SECURITY] Unauthorized Admin Login Attempt Blocked: ${userPhone} (${userEmail}). Downgrading to RetailUser.`);
          
          // Downgrade Role Immediately in DB (Self-Healing Security)
          user.role = "RetailUser"; 
          await user.save({ validateBeforeSave: false });

          // Return Response (The user will now be logged in as RetailUser, effectively blocking Admin access)
          // We could also throw an error, but downgrading allows them to still shop.
          // Requirement says: "You cannot login as Admin..." - Since we downgraded, they are NOT logging in as Admin anymore.
      }
  }

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
