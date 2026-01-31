/**
 * Excel Sync Script - Syncs products.xlsx with MongoDB
 * 
 * Features:
 * - Creates backup before sync
 * - Deactivates products NOT in Excel
 * - Creates/updates products from Excel
 * - Auto-creates categories
 * - Progress logging
 * 
 * Usage: node scripts/sync_excel.js
 */

import xlsx from "xlsx";
import mongoose from "mongoose";
import { config } from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { Product } from "../models/productSchema.js";
import { Category } from "../models/categorySchema.js";
import { fetchPexelsImages } from "../utils/pexels.js";
import fs from "fs";

// Config
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Always load config file
config({ path: path.join(__dirname, "../config/config.env") });

// Database connection
const MONGO_URI = process.env.MONGO_URI;
const DB_NAME = "ECOMMERCE_WHOLESALE";

const connectDB = async () => {
  try {
    console.log("🔌 Connecting to database...");
    console.log(`   URI: ${MONGO_URI.substring(0, 50)}...`);
    await mongoose.connect(MONGO_URI, { dbName: DB_NAME });
    console.log(`✅ Connected to ${DB_NAME}`);
  } catch (err) {
    console.error("❌ DB Connection Failed:", err.message);
    process.exit(1);
  }
};

// Create backup of current products
const createBackup = async () => {
  console.log("\n📦 Creating backup...");
  
  const products = await Product.find({}).lean();
  const categories = await Category.find({}).lean();
  
  const backup = {
    timestamp: new Date().toISOString(),
    products: products,
    categories: categories
  };
  
  const backupDir = path.join(__dirname, "../backups");
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }
  
  const backupFile = path.join(backupDir, `backup_${Date.now()}.json`);
  fs.writeFileSync(backupFile, JSON.stringify(backup, null, 2));
  
  console.log(`   ✅ Backup saved: ${backupFile}`);
  console.log(`   📊 Products backed up: ${products.length}`);
  console.log(`   📊 Categories backed up: ${categories.length}`);
  
  return backupFile;
};

// Read Excel file
const readExcel = () => {
  const excelPath = path.resolve(__dirname, "../../products.xlsx");
  console.log(`\n📂 Reading Excel: ${excelPath}`);
  
  if (!fs.existsSync(excelPath)) {
    throw new Error(`Excel file not found at ${excelPath}`);
  }
  
  const workbook = xlsx.readFile(excelPath);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const data = xlsx.utils.sheet_to_json(sheet);
  
  console.log(`   ✅ Found ${data.length} rows in Excel`);
  
  if (data.length > 0) {
    console.log(`   📋 Columns: ${Object.keys(data[0]).join(", ")}`);
  }
  
  return data;
};

// Sync products with Excel
const syncProducts = async (excelData) => {
  console.log("\n🔄 Starting sync...");
  
  // Step 1: Mark all products as inactive (we'll reactivate those in Excel)
  console.log("   [1/5] Deactivating all products...");
  const deactivated = await Product.updateMany({}, { isActive: false, importedFromExcel: false });
  console.log(`         Deactivated: ${deactivated.modifiedCount} products`);
  
  // Step 2: Clear and rebuild categories
  console.log("   [2/5] Rebuilding categories...");
  await Category.deleteMany({});
  
  const categoryMap = new Map();
  const uniqueCategories = [...new Set(excelData.map(row => 
    (row["Category"] || "General").trim()
  ))];
  
  for (const catName of uniqueCategories) {
    let catImgUrl = "https://via.placeholder.com/150";
    try {
      const pexels = await fetchPexelsImages(catName + " grocery items", 1);
      if (pexels.length > 0) catImgUrl = pexels[0].url;
    } catch (e) {}
    
    const cat = await Category.create({
      categoryName: catName,
      categoryImage: { url: catImgUrl, public_id: null }
    });
    categoryMap.set(catName, cat);
    console.log(`         ✅ Created category: ${catName}`);
  }
  
  // Step 3: Process each Excel row
  console.log("   [3/5] Importing products...");
  let imported = 0;
  let updated = 0;
  let errors = 0;
  
  const productNamesInExcel = new Set();
  
  for (const [index, row] of excelData.entries()) {
    try {
      const name = (row["Item name*"] || row["Item name"] || row["Product Name"] || "").trim();
      if (!name) continue;
      
      productNamesInExcel.add(name.toLowerCase());
      
      const categoryName = (row["Category"] || "General").trim();
      const price = parseFloat(row["Sale price"] || row["Selling Price"] || 0) || 0;
      const stock = parseInt(row["Current stock quantity"] || row["Stock"] || 0) || 0;
      const unit = row["Base Unit (x)"] || row["Base Unit"] || row["Unit"] || "pcs";
      const purchasePrice = parseFloat(row["Purchase price"] || 0) || 0;
      const mrp = parseFloat(row["Default Mrp"] || row["MRP"] || price) || price;
      
      // Find existing product by name
      let product = await Product.findOne({ 
        productName: { $regex: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, "i") } 
      });
      
      // Prepare image
      let image = { url: "https://via.placeholder.com/150", public_id: null };
      if (product?.image?.url && !product.image.url.includes("placeholder")) {
        image = product.image;
      } else {
        try {
          const pexels = await fetchPexelsImages(name + " food", 1);
          if (pexels.length > 0) {
            image = { url: pexels[0].url, public_id: null };
          }
        } catch (e) {}
      }
      
      const productData = {
        productName: name,
        description: row["Description"] || `Premium quality ${name}`,
        parentCategory: categoryName,
        subCategory: categoryName,
        price: price.toString(),
        costPrice: purchasePrice,
        originalPrice: mrp > price ? mrp : undefined,
        stock: stock,
        unit: unit,
        image: image,
        isActive: true,
        importedFromExcel: true,
        lastSyncedAt: new Date(),
        b2bMinQty: 6,
        isB2BAvailable: true
      };
      
      if (product) {
        Object.assign(product, productData);
        await product.save();
        updated++;
      } else {
        await Product.create(productData);
        imported++;
      }
      
      // Progress indicator
      if ((imported + updated) % 20 === 0) {
        process.stdout.write(`\r         Progress: ${imported + updated}/${excelData.length}`);
      }
      
    } catch (err) {
      errors++;
      console.error(`\n         ❌ Error on row ${index + 1}: ${err.message}`);
    }
  }
  
  console.log(`\n         ✅ Imported: ${imported} new products`);
  console.log(`         ✅ Updated: ${updated} existing products`);
  if (errors > 0) console.log(`         ⚠️  Errors: ${errors}`);
  
  // Step 4: Count final stats
  console.log("   [4/5] Verifying sync...");
  const activeProducts = await Product.countDocuments({ isActive: true });
  const activeCategories = await Category.countDocuments();
  console.log(`         Active products: ${activeProducts}`);
  console.log(`         Active categories: ${activeCategories}`);
  
  // Step 5: Done
  console.log("   [5/5] Sync complete!");
  
  return { imported, updated, errors, activeProducts, activeCategories };
};

// Main function
const main = async () => {
  console.log("═══════════════════════════════════════════════════════════");
  console.log("  📊 EXCEL SYNC - Aman Enterprises Product Management");
  console.log("═══════════════════════════════════════════════════════════");
  console.log(`  Started: ${new Date().toLocaleString()}`);
  
  try {
    await connectDB();
    await createBackup();
    
    const excelData = readExcel();
    const stats = await syncProducts(excelData);
    
    console.log("\n═══════════════════════════════════════════════════════════");
    console.log("  ✅ SYNC COMPLETE!");
    console.log("═══════════════════════════════════════════════════════════");
    console.log(`  📦 New Products: ${stats.imported}`);
    console.log(`  🔄 Updated Products: ${stats.updated}`);
    console.log(`  📊 Total Active: ${stats.activeProducts}`);
    console.log(`  📁 Categories: ${stats.activeCategories}`);
    console.log("═══════════════════════════════════════════════════════════");
    
  } catch (err) {
    console.error("\n❌ SYNC FAILED:", err.message);
    console.error(err.stack);
  }
  
  process.exit(0);
};

main();
