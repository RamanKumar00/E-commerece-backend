import express from "express";

import { addBannerImages, getHomeScreenData, getProduct, newProduct, removeABannerImage } from "../controllers/productController.js";
import { isAdminAuthenticated, isAuthenticated } from "../middlewares/auth.js";
const app = express.Router();

// route - /api/product/addnew
app.post("/addnew",  isAdminAuthenticated, newProduct);

// route - /api/product/:productId
app.get("/", isAuthenticated, getProduct);

// route - /api/product/addbanner
app.post("/banner-image/addnew", isAdminAuthenticated, addBannerImages);

// route - /api/product/banner-image/:publicId
app.delete("/banner-image", isAdminAuthenticated, removeABannerImage);




// route - /api/product/homescreendata
app.get("/homescreendata", isAuthenticated, getHomeScreenData);

export default app;
