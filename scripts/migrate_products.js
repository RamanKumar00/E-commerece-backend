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
config({ path: path.join(__dirname, "../config/config.env") });

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, { dbName: "ECOMMERCE_WHOLESALE" });
    console.log("✅ DB Connected");
  } catch (err) {
    console.error("❌ DB Connection Failed", err);
    process.exit(1);
  }
};

const runMigration = async () => {
    await connectDB();

    console.log("🔄 Deactivating old products to cleanup catalog...");
    // 1. Deactivate All (Hide everything first)
    await Product.updateMany({}, { isActive: false });
    
    // Clear Categories to ensure only Excel categories are present
    console.log("🧹 Clearing existing categories...");
    await Category.deleteMany({});
    
    // 2. Read Excel
    const excelPath = path.resolve(__dirname, "../../products.xlsx"); 
    console.log(`📂 Reading Excel from: ${excelPath}`);
    
    if (!fs.existsSync(excelPath)) {
        console.error(`❌ Excel file not found! Please ensure 'products.xlsx' is in 'Aman Enterprises Backend/'.`);
        process.exit(1);
    }
    
    const workbook = xlsx.readFile(excelPath);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(sheet);

    if (!data.length) {
        console.error("❌ Excel file is empty!");
        process.exit(1);
    }

    console.log(`📊 Found ${data.length} products. Starting import...`);
    
    // DEBUG: Print keys of the first row to check column names
    if (data.length > 0) {
        console.log("🔍 Excel Column Headers:", Object.keys(data[0]));
        console.log("🔍 First Row Sample:", JSON.stringify(data[0]));
    }

    let imported = 0;
    const categoryCache = new Set();

    for (const [index, row] of data.entries()) {
        try {
            // Support multiple variations including "Item name*" (common in some exports)
            const name = (row["Item name*"] || row["Item name"] || row["Product Name"] || row["Item Name"] || "").trim();
            if (!name) {
                 // if (index < 5) console.log(`⚠️  Skipping row ${index + 1}: Name is empty. Keys: ${Object.keys(row).join(", ")}`);
                 continue;
            }

            const categoryName = (row["Category"] || row["Category Name"] || "General").trim();
            
            // 3. Auto-Create/Ensure Category Exists
            if (!categoryCache.has(categoryName)) {
                let cat = await Category.findOne({ categoryName: { $regex: new RegExp(`^${categoryName}$`, "i") } });
                
                if (!cat) {
                    console.log(`🆕 Creating New Category: ${categoryName}`);
                    
                    // Fetch category image
                    let catImgUrl = "https://via.placeholder.com/150";
                    try {
                        const pexels = await fetchPexelsImages(categoryName + " grocery", 1);
                        if (pexels.length > 0) catImgUrl = pexels[0].url;
                    } catch (e) {}

                    cat = await Category.create({
                        categoryName,
                        categoryImage: { url: catImgUrl, public_id: null }
                    });
                }
                categoryCache.add(categoryName);
            }

            // 4. Process Product
            const price = String(row["Sale price"] || row["Selling Price"] || "0");
            const stock = parseInt(row["Current stock quantity"] || row["Stock"] || 0);
            const unit = row["Base Unit"] || row["Unit"] || "pcs";
            const sku = row["SKU"] || undefined; // If no SKU, let it be undefined or handle duplicate names

            // Check if product exists (by name, case insensitive)
            let product = await Product.findOne({ productName: { $regex: new RegExp(`^${name}$`, "i") } });

            // Image Logic: Fetch only if missing or placeholder
            let image = { url: "https://via.placeholder.com/150", public_id: null };
            
            if (product && product.image && product.image.url && !product.image.url.includes("placeholder")) {
                image = product.image;
            } else {
                try {
                    const pexels = await fetchPexelsImages(name + " grocery", 1);
                    if (pexels.length > 0) {
                        image = { url: pexels[0].url, public_id: null };
                    }
                } catch (e) {
                    console.log(`⚠️ Image fetch failed for ${name}`);
                }
            }

            const productPayload = {
                productName: name,
                description: row["Description"] || `Fresh ${name} - High quality.`,
                parentCategory: categoryName,
                subCategory: row["Sub Category"] || categoryName,
                price: price,
                stock: stock,
                costPrice: Number(row["Purchase price"] || 0),
                discount: Number(row["Discount"] || 0),
                unit: unit,
                sku: sku,
                image: image,
                isActive: true, // ⚠️ CRITICAL: Only these become active
                importedFromExcel: true, // Tag for audit
                b2bMinQty: 6,   // Enforce default rule
                isB2BAvailable: true
            };

            if (product) {
                // Update existing
                Object.assign(product, productPayload);
                await product.save();
            } else {
                // Create new
                await Product.create(productPayload);
            }
            imported++;
            
            // Progress log every 10 items
            if (imported % 10 === 0) process.stdout.write(".");

        } catch (err) {
            console.error(`\n❌ Error processing row ${JSON.stringify(row).substring(0, 50)}... : ${err.message}`);
        }
    }

    console.log(`\n\n✅ Migration Success!`);
    console.log(`👉 Processed: ${data.length} rows`);
    console.log(`👉 Active Products: ${imported}`);
    
    process.exit(0);
};

runMigration();
