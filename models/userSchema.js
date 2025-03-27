import mongoose, { mongo } from "mongoose";
import validator from "validator";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

const userSchema = new mongoose.Schema({
  shopName: {
    type: String,
    required: true,
  },
  phone: {
    type: String,
    required: true,
    unique: true,
    minLength: [10, "Phone Number Must Contain Exact 10 Digits!"],
    maxLength: [10, "Phone Number Must Contain Exact 10 Digits!"],
  },
  email: {
    type: String,
    required: true,
    validate: [validator.isEmail, "Please Provide A Valid Email!"],
  },
  address: {
    type: String,
    required: true,
  },
  pincode: {
    type: String,
    required: true,
    minLength: [6, "Pincode Must Contain Exact 6 Digits!"],
    maxLength: [6, "Pincode Must Contain Exact 6 Digits!"],
  },
  state: {
    type: String,
    required: true,
  },
  city: {
    type: String,
    required: true,
  },
  role: {
    type: String,
    required: true,
    enum: ["Admin", "RetailUser"],
  },
  password: {
    type: String,
    minLength: [8, "Password Must contain at least 8 characters!"],
    required: true,
    select: false,
  },
  loginOtp: { type: String },
  loginOtpExpiry: { type: Date },
  passwordRecoveryOtp: { type: String },
  passwordRecoveryOtpExpiry: { type: Date },
});

userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) {
    next();
  }
  this.password = await bcrypt.hash(this.password, 10);
});

userSchema.methods.comparePassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

userSchema.methods.generateJsonWebToken = function () {
  return jwt.sign({ id: this._id }, process.env.JWT_SECRET_KEY, {
    expiresIn: process.env.JWT_EXPIRES,
  });
};

export const User = mongoose.model("User", userSchema);
