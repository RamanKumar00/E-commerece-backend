import express from "express";

import { addBannerImages, getHomeScreenData, getPaginatedProducts, getProduct, newProduct, removeABannerImage, searchProduct,
  deleteProduct, updateProduct,
  getSuggestedImages,
} from "../controllers/productController.js";
import { isAdminAuthenticated, isAuthenticated } from "../middlewares/auth.js";
const app = express.Router();

// route - /api/product/addnew
app.post("/addnew",  isAdminAuthenticated, newProduct);

// route - /api/product/update/:id
app.put("/update/:id", isAdminAuthenticated, updateProduct);

// route - /api/product/:productId
app.get("/", isAuthenticated, getProduct);

// route - /api/product/addbanner
app.post("/banner-image/addnew", isAdminAuthenticated, addBannerImages);

// route - /api/product/banner-image/:publicId
app.delete("/banner-image", isAdminAuthenticated, removeABannerImage);




// route - /api/product/homescreendata
app.get("/homescreendata", isAuthenticated, getHomeScreenData);

// route - /api/product/:query(eg. shampoo, dove etc.)
app.get("/search", isAuthenticated, searchProduct);

// route - /api/product?page=1
app.get("/paginated", isAuthenticated, getPaginatedProducts);

// route - /api/v1/product/delete/:id
app.delete("/delete/:id", isAuthenticated, deleteProduct);

// route - /api/v1/product/suggest-images
app.get("/suggest-images", isAuthenticated, getSuggestedImages);

import { fixProductImages } from "../controllers/productController.js";
// route - /api/v1/product/fix-images (Admin Maintenance)
app.get("/fix-images", isAdminAuthenticated, fixProductImages);

export default app;
