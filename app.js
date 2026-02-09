import express from "express";
import { dbConnection } from "./database/dbConnection.js";
import { config } from "dotenv";
import cookieParser from "cookie-parser";
import cors from "cors";
import fileUpload from "express-fileupload";
import { errorMiddleware } from "./middlewares/error.js";
import userRouter from "./routes/userRouter.js";
import categoryRouter from "./routes/categoryRouter.js";
import productRouter from "./routes/productRouter.js";
import orderRouter from "./routes/orderRouter.js";
import couponRouter from "./routes/couponRouter.js";
import wishlistRouter from "./routes/wishlistRouter.js";
import deliverySlotRouter from "./routes/deliverySlotRouter.js";
import notificationRouter from "./routes/notificationRouter.js";
import analyticsRouter from "./routes/analyticsRouter.js";
import paymentRouter from "./routes/paymentRouter.js";
import flashDealRouter from "./routes/flashDealRouter.js";
import productImportRouter from "./routes/productImportRouter.js";
import reviewRouter from "./routes/reviewRouter.js";
import invoiceRouter from "./routes/invoiceRouter.js";
import bulkProductRouter from "./routes/bulkProductRouter.js";
import courierRouter from "./routes/courierRouter.js";
import cashfreeRouter from "./routes/cashfreeRouter.js";
import { languageMiddleware } from "./middlewares/language.js";


const app = express();
// Only load config.env if MONGO_URI not already set (Render sets env vars directly)
if (!process.env.MONGO_URI) {
  config({ path: "./config/config.env" });
}

app.use(
  cors({
    origin:"*",
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
    method: ["GET", "POST", "DELETE", "PUT"],
    credentials: true,
  })
);

app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
  fileUpload({
    useTempFiles: true,
    tempFileDir: "/tmp/",
  })
);

app.use(languageMiddleware);
app.use("/api/v1/user", userRouter);
app.use("/api/v1/category", categoryRouter);
app.use("/api/v1/product", productRouter);
app.use("/api/v1/coupon", couponRouter);
app.use("/api/v1/order", orderRouter);
app.use("/api/v1/wishlist", wishlistRouter);
app.use("/api/v1/delivery-slot", deliverySlotRouter);
app.use("/api/v1/notification", notificationRouter);
app.use("/api/v1/analytics", analyticsRouter);
app.use("/api/v1/payment", paymentRouter);
app.use("/api/v1/flash-deal", flashDealRouter);
app.use("/api/v1/product-ops", productImportRouter);
app.use("/api/v1/review", reviewRouter);
app.use("/api/v1/invoice", invoiceRouter);
app.use("/api/v1/bulk", bulkProductRouter);
app.use("/api/v1/courier", courierRouter);
app.use("/api/v1/cashfree", cashfreeRouter);

// Privacy Policy Page - Required for Play Store and Payment Gateways
app.get("/privacy-policy", (req, res) => {
  res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Privacy Policy - Aman Enterprises</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.8; color: #333; background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%); min-height: 100vh; padding: 20px; }
        .container { max-width: 900px; margin: 0 auto; background: white; border-radius: 16px; box-shadow: 0 10px 40px rgba(0,0,0,0.1); padding: 40px 50px; }
        .header { text-align: center; margin-bottom: 40px; padding-bottom: 30px; border-bottom: 3px solid #4CAF50; }
        .logo { width: 80px; height: 80px; background: linear-gradient(135deg, #4CAF50, #2E7D32); border-radius: 20px; margin: 0 auto 20px; display: flex; align-items: center; justify-content: center; font-size: 36px; color: white; }
        h1 { color: #2E7D32; font-size: 2.5em; margin-bottom: 10px; }
        .subtitle { color: #666; font-size: 1.1em; }
        .last-updated { background: #E8F5E9; color: #2E7D32; padding: 8px 16px; border-radius: 20px; display: inline-block; margin-top: 15px; font-size: 0.9em; }
        h2 { color: #1B5E20; margin-top: 35px; margin-bottom: 15px; padding-bottom: 10px; border-bottom: 2px solid #E8F5E9; font-size: 1.5em; }
        h3 { color: #388E3C; margin-top: 25px; margin-bottom: 10px; font-size: 1.2em; }
        p { margin-bottom: 15px; text-align: justify; }
        ul { margin: 15px 0 15px 30px; }
        li { margin-bottom: 10px; }
        .highlight-box { background: linear-gradient(135deg, #E8F5E9, #C8E6C9); border-left: 4px solid #4CAF50; padding: 20px; margin: 20px 0; border-radius: 0 10px 10px 0; }
        .contact-box { background: #F5F5F5; padding: 25px; border-radius: 12px; margin-top: 30px; }
        .contact-box h3 { margin-top: 0; }
        a { color: #4CAF50; text-decoration: none; }
        a:hover { text-decoration: underline; }
        .footer { text-align: center; margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee; color: #888; font-size: 0.9em; }
        @media (max-width: 600px) { .container { padding: 25px 20px; } h1 { font-size: 1.8em; } }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="logo">🛒</div>
            <h1>Privacy Policy</h1>
            <p class="subtitle">Aman Enterprises - Fresh Groceries Delivered</p>
            <span class="last-updated">Last Updated: February 9, 2026</span>
        </div>
        <div class="highlight-box">
            <strong>Your privacy matters to us.</strong> This Privacy Policy explains how Aman Enterprises ("we", "us", or "our") collects, uses, and protects your personal information when you use our mobile application.
        </div>
        <h2>1. Information We Collect</h2>
        <h3>1.1 Personal Information</h3>
        <p>When you create an account or place an order, we may collect:</p>
        <ul>
            <li><strong>Contact Information:</strong> Name, email address, phone number</li>
            <li><strong>Account Credentials:</strong> Password (encrypted)</li>
            <li><strong>Delivery Information:</strong> Address, location coordinates</li>
            <li><strong>Payment Information:</strong> Transaction details (we do not store complete card numbers)</li>
        </ul>
        <h3>1.2 Automatically Collected Information</h3>
        <ul>
            <li>Device information (model, operating system)</li>
            <li>App usage data and preferences</li>
            <li>Location data (with your permission)</li>
            <li>Push notification tokens</li>
        </ul>
        <h2>2. How We Use Your Information</h2>
        <p>We use your information to:</p>
        <ul>
            <li>Process and deliver your orders</li>
            <li>Create and manage your account</li>
            <li>Send order updates and notifications</li>
            <li>Improve our app and services</li>
            <li>Provide customer support</li>
            <li>Send promotional offers (with your consent)</li>
            <li>Ensure platform security and prevent fraud</li>
        </ul>
        <h2>3. Information Sharing</h2>
        <p>We may share your information with:</p>
        <ul>
            <li><strong>Delivery Partners:</strong> To fulfill your orders</li>
            <li><strong>Payment Processors:</strong> To process transactions securely</li>
            <li><strong>Service Providers:</strong> Who help us operate our platform</li>
            <li><strong>Legal Authorities:</strong> When required by law</li>
        </ul>
        <p><strong>We never sell your personal information to third parties.</strong></p>
        <h2>4. Data Security</h2>
        <p>We implement industry-standard security measures including:</p>
        <ul>
            <li>SSL/TLS encryption for data transmission</li>
            <li>Encrypted password storage</li>
            <li>Secure payment processing through certified gateways</li>
            <li>Regular security audits and updates</li>
        </ul>
        <h2>5. Your Rights</h2>
        <p>You have the right to:</p>
        <ul>
            <li><strong>Access:</strong> Request a copy of your personal data</li>
            <li><strong>Correction:</strong> Update or correct your information</li>
            <li><strong>Deletion:</strong> Request deletion of your account and data</li>
            <li><strong>Opt-out:</strong> Unsubscribe from marketing communications</li>
        </ul>
        <h2>6. Children's Privacy</h2>
        <p>Our services are not directed to children under 13. We do not knowingly collect personal information from children.</p>
        <h2>7. Third-Party Services</h2>
        <p>Our app integrates with third-party services including Google (Sign-In, Maps, Firebase), Payment gateways (Cashfree, Razorpay), and Cloud services.</p>
        <h2>8. Data Retention</h2>
        <p>We retain your data for as long as your account is active. Upon deletion request, we remove your data within 30 days.</p>
        <h2>9. Changes to This Policy</h2>
        <p>We may update this Privacy Policy from time to time. We will notify you of significant changes through the app or email.</p>
        <div class="contact-box">
            <h3>📧 Contact Us</h3>
            <p>If you have questions about this Privacy Policy, please contact us:</p>
            <p>
                <strong>Aman Enterprises</strong><br>
                Email: <a href="mailto:amanenterprises01720@gmail.com">amanenterprises01720@gmail.com</a><br>
                Phone: +91-9097037320<br>
                Address: Hira Complex, Near Ganesh Vivah Bhawan,<br>
                Bairiya to Zero Mile Road,<br>
                Muzaffarpur - 842003, Bihar, India
            </p>
        </div>
        <div class="footer">
            <p>© 2026 Aman Enterprises. All rights reserved.</p>
        </div>
    </div>
</body>
</html>
  `);
});

// Root endpoint - Shows basic info for payment gateway verification
app.get("/", (req, res) => {
  res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Aman Enterprises - Fresh Groceries Delivered</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Segoe UI', sans-serif; background: linear-gradient(135deg, #4CAF50 0%, #2E7D32 100%); min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 20px; }
        .card { background: white; border-radius: 20px; padding: 50px; text-align: center; box-shadow: 0 20px 60px rgba(0,0,0,0.3); max-width: 500px; }
        .logo { font-size: 80px; margin-bottom: 20px; }
        h1 { color: #2E7D32; font-size: 2em; margin-bottom: 10px; }
        p { color: #666; font-size: 1.1em; margin-bottom: 20px; }
        .badge { background: #E8F5E9; color: #2E7D32; padding: 10px 20px; border-radius: 25px; display: inline-block; font-weight: bold; }
        .links { margin-top: 30px; }
        .links a { color: #4CAF50; text-decoration: none; margin: 0 15px; }
        .links a:hover { text-decoration: underline; }
    </style>
</head>
<body>
    <div class="card">
        <div class="logo">🛒</div>
        <h1>Aman Enterprises</h1>
        <p>Fresh Groceries Delivered to Your Doorstep</p>
        <div class="badge">✓ API Server Online</div>
        <div class="links">
            <a href="/privacy-policy">Privacy Policy</a>
            <a href="/api/v1/health">API Health</a>
        </div>
        <p style="margin-top: 30px; font-size: 0.9em; color: #999;">
            📍 Muzaffarpur, Bihar, India<br>
            📧 amanenterprises01720@gmail.com<br>
            📞 +91-9097037320
        </p>
    </div>
</body>
</html>
  `);
});

// Debug health check endpoint
import mongoose from "mongoose";
import { Category } from "./models/categorySchema.js";
import { Product } from "./models/productSchema.js";

app.get("/api/v1/health", async (req, res) => {
  try {
    const dbState = mongoose.connection.readyState;
    const dbStates = { 0: 'disconnected', 1: 'connected', 2: 'connecting', 3: 'disconnecting' };
    
    // Get all collections
    const collections = await mongoose.connection.db.listCollections().toArray();
    const collectionNames = collections.map(c => c.name);
    
    // Direct raw query to check data
    const rawCategories = await mongoose.connection.db.collection('categories').countDocuments();
    const rawProducts = await mongoose.connection.db.collection('products').countDocuments({ isActive: true });
    
    const categoryCount = await Category.countDocuments();
    const productCount = await Product.countDocuments({ isActive: true });
    
    res.json({
      success: true,
      database: {
        status: dbStates[dbState] || 'unknown',
        dbName: mongoose.connection.name || 'not connected',
      },
      counts: {
        categories: categoryCount,
        activeProducts: productCount,
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: "Health check failed"
    });
  }
});

dbConnection();

app.use(errorMiddleware);
export default app;
