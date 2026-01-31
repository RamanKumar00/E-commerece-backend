import xlsx from "xlsx";
import { Product } from "../models/productSchema.js";
import { fetchPexelsImages } from "../utils/pexels.js";
import crypto from "crypto";

export const importProducts = async (req, res) => {
  try {
    if (!req.files || !req.files.file) {
      return res.status(400).json({ success: false, message: "No file uploaded" });
    }

    const file = req.files.file;
    let workbook;
    if (file.tempFilePath) {
      workbook = xlsx.readFile(file.tempFilePath);
    } else {
      workbook = xlsx.read(file.data, { type: "buffer" });
    }
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(sheet);

    if (!data || data.length === 0) {
      return res.status(400).json({ success: false, message: "Excel file is empty" });
    }

    // 1. Deactivate all existing products
    await Product.updateMany({}, { isActive: false });

    let importedCount = 0;
    let skippedCount = 0;
    let errors = [];

    const productsToInsert = [];

    for (const row of data) {
      try {
        // Map Columns
        // Expected Excel Headers: "Item name", "Category", "Sale price", "Purchase price", "Current stock quantity", "Discount", "Base Unit"
        
        const productName = row["Item name*"] || row["Item name"] || row["Product Name"];
        if (!productName) {
          skippedCount++;
          errors.push(`Row skipped: Missing Product Name`);
          continue;
        }

        const categoryRaw = row["Category"] || "Personal Care Products"; // Default or Map
        // Validate Category if possible, or trust it matches Enum. 
        // For robustness, ensure it matches one of the Enums or fallback.
        // Current Enums: "Personal Care Products", "Food & Beverages", "Home Care Products", "Baby Care Products", "Health Care Products"
        // We will just use it as is, validation might fail on save if strict.

        const price = row["Sale price"] || row["Selling Price"] || "0";
        const costPrice = row["Purchase price"] || row["Cost Price"] || 0;
        const stock = parseInt(row["Current stock quantity"] || row["Stock"] || 0);
        const discount = row["Discount"] || row["Offer"] || 0;
        const unit = row["Base Unit"] || row["Unit"] || "pcs";
        
        let sku = row["SKU"];
        if (!sku) {
           // Generate SKU: CAT-NAME-RANDOM
           const prefix = productName.substring(0, 3).toUpperCase();
           sku = `${prefix}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
        }

        // Image Handling
        let image = {
          url: "https://via.placeholder.com/150", // Default placeholder
          public_id: null
        };

        // If Excel has an image URL column (optional)
        if (row["Image"] || row["Image URL"]) {
            image.url = row["Image"] || row["Image URL"];
        } else {
            // Auto-fetch from Pexels
            try {
                const pexelsImages = await fetchPexelsImages(productName, 1);
                if (pexelsImages && pexelsImages.length > 0) {
                    image.url = pexelsImages[0].url;
                    // We could store pexelsPhotoId if we want
                }
            } catch (imgErr) {
                console.error(`Image fetch failed for ${productName}:`, imgErr.message);
            }
        }

        const newProduct = {
          productName: productName.trim(),
          description: row["Description"] || `High quality ${productName}`, // Auto-generate description if missing
          parentCategory: categoryRaw, // Needs to match Enum
          subCategory: row["Sub Category"] || categoryRaw, // Default to parent if missing
          price: String(price),
          stock: stock <= 0 ? 0 : stock,
          costPrice: Number(costPrice),
          discount: Number(discount),
          unit: unit,
          sku: sku,
          image: image,
          isActive: true,
          // B2B defaults
          b2bMinQty: 6,
          isB2BAvailable: true
        };

        productsToInsert.push(newProduct);

      } catch (rowError) {
        skippedCount++;
        errors.push(`Row processing error: ${rowError.message}`);
      }
    }

    // Insert in Batches
    // Note: If any product fails validation (e.g. invalid Enum), insertMany might fail the whole batch unless ordered: false is used?
    // We'll use ordered: false to allow successful ones to pass.
    
    let result;
    if (productsToInsert.length > 0) {
       try {
          result = await Product.insertMany(productsToInsert, { ordered: false });
          importedCount = result.length;
       } catch (insertError) {
          // insertMany throws if some fail. 
          // insertError.insertedDocs contains successful ones (if available in version) or we check count.
          if (insertError.insertedDocs) {
              importedCount = insertError.insertedDocs.length;
          } else {
              // Only some failed
              importedCount = insertError.result ? insertError.result.nInserted : 0;
          }
           errors.push(`Bulk Insert Error: ${insertError.message}`);
       }
    }

    res.status(200).json({
      success: true,
      message: "Import processing complete",
      summary: {
        totalProcessed: data.length,
        imported: importedCount,
        skipped: skippedCount + (productsToInsert.length - importedCount),
        errors: errors
      }
    });

  } catch (error) {
    console.error("Import Error:", error);
    res.status(500).json({ success: false, message: "Server Error during import", error: error.message });
  }
};
