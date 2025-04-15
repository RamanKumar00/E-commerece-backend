import express from "express";
import { dbConnection } from "./database/dbConnection.js";
import { config } from "dotenv";
import cookieParser from "cookie-parser";
import cors from "cors";
import fileUpload from "express-fileupload";
import { errorMiddleware } from "./middlewares/error.js";
import userRouter from "./routes/userRouter.js"
import productRouter from "./routes/productRouter.js"
import categoryRouter from "./routes/categoryRouter.js"
const app = express();
config({ path: "./config/config.env" });

// app.use(
//   cors({
//     origin: [process.env.FRONTEND_URL_ONE],
//     method: ["GET", "POST", "DELETE", "PUT"],
//     credentials: true,
//   })
// );

app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
  fileUpload({
    useTempFiles: true,
    tempFileDir: "/tmp/",
  })
);

//routes
app.use("/api/v1/user", userRouter);
app.use("/api/v1/product", productRouter);
app.use("/api/v1/category", categoryRouter);

dbConnection();

app.use(errorMiddleware);
export default app;
