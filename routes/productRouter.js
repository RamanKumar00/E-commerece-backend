import express from "express";

import { isAuthenticated } from "../middlewares/auth.js";
import { addBannerImages, getProduct, newProduct, removeABannerImage } from "../controllers/productController.js";
const app = express.Router();

// route - /api/product/addnew
app.post("/addnew", isAuthenticated, newProduct);

// route - /api/product/:productId
app.get("/", isAuthenticated, getProduct);

// route - /api/product/addbanner
app.post("/banner-image/addnew", isAuthenticated, addBannerImages);

// route - /api/product/banner-image/:publicId
app.delete("/banner-image", isAuthenticated, removeABannerImage);
export default app;
