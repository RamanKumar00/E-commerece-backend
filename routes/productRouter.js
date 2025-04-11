import express from "express";

import { isAdminAuthenticated, isAuthenticated } from "../middlewares/auth.js";
import { addBannerImages, addNewCategory, getCategories, getHomeScreenData, getProduct, newProduct, removeABannerImage, removeACategory } from "../controllers/productController.js";
const app = express.Router();

// route - /api/product/addnew
app.post("/addnew",  isAdminAuthenticated, newProduct);

// route - /api/product/:productId
app.get("/", isAuthenticated, getProduct);

// route - /api/product/addbanner
app.post("/banner-image/addnew", isAdminAuthenticated, addBannerImages);

// route - /api/product/banner-image/:publicId
app.delete("/banner-image", isAdminAuthenticated, removeABannerImage);

// route - /api/product/category/addnew
app.post("/category/addnew", isAdminAuthenticated, addNewCategory);

// route - /api/product/category
app.get("/category", isAuthenticated, getCategories);

// route - /api/product/category
app.delete("/category", isAdminAuthenticated, removeACategory);


// route - /api/product/homescreendata
app.get("/homescreendata", isAuthenticated, getHomeScreenData);

export default app;
