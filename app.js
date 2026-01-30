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

dbConnection();

app.use(errorMiddleware);
export default app;
