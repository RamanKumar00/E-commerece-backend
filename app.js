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
import { languageMiddleware } from "./middlewares/language.js";

const app = express();
config({ path: "./config/config.env" });

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
        stateCode: dbState,
        dbName: mongoose.connection.name || 'not connected',
        host: mongoose.connection.host || 'unknown',
        collections: collectionNames
      },
      counts: {
        categories: categoryCount,
        activeProducts: productCount,
        rawCategories: rawCategories,
        rawProducts: rawProducts
      },
      mongoUri: process.env.MONGO_URI ? process.env.MONGO_URI.substring(0, 50) + '...' : 'NOT SET'
    });
  } catch (error) {
    res.json({
      success: false,
      error: error.message,
      stack: error.stack?.substring(0, 200),
      mongoUri: process.env.MONGO_URI ? 'SET' : 'NOT SET'
    });
  }
});

dbConnection();

app.use(errorMiddleware);
export default app;
