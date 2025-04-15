import express from "express";

import { addNewCategory, addNewSubCategory, getCategories, getSubCategoriesOfCategory, removeACategory,  } from "../controllers/categoryController.js";
import { isAdminAuthenticated, isAuthenticated } from "../middlewares/auth.js";
const app = express.Router();

//Categories
// route - /api/v1/category/addnew
app.post("/addnew", isAdminAuthenticated, addNewCategory);

// route - /api/v1/category
app.get("/", isAuthenticated, getCategories);

// route - /api/v1/category
app.delete("/", isAdminAuthenticated, removeACategory);

//SubCategories
// route - /api/v1/category/subcategory/addnew
app.post("/subcategory/addnew", isAdminAuthenticated, addNewSubCategory);

// route - /api/v1/category/subcategory
app.get("/subcategory", isAuthenticated, getSubCategoriesOfCategory);

// route - /api/v1/category/subcategory
// app.delete("/subcategory", isAdminAuthenticated, removeASubCategory);

export default app;
