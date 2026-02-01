import { catchAsyncError } from "../middlewares/catchAsyncError.js";
import ErrorHandler from "../middlewares/error.js";
import { Product } from "../models/productSchema.js";
import xlsx from "xlsx";
import path from "path";

// ==================== SAMPLE TEMPLATE ====================

// Generate sample download template
export const downloadTemplate = catchAsyncError(async (req, res, next) => {
  const sampleData = [
    {
      "Product Name": "Sample Product 1",
      "Category": "Groceries",
      "Description": "This is a sample product description",
      "MRP": 100,
      "Selling Price": 90,
      "Stock Quantity": 50,
      "B2B Price": 80,
      "B2B Min Quantity": 6,
      "HSN Code": "1234",
      "Image URL": "https://example.com/image.jpg",
      "Availability": "yes",
      "Unit": "kg",
      "Weight": "1"
    },
    {
      "Product Name": "Sample Product 2",
      "Category": "Dairy",
      "Description": "Another sample product",
      "MRP": 50,
      "Selling Price": 45,
      "Stock Quantity": 100,
      "B2B Price": 40,
      "B2B Min Quantity": 12,
      "HSN Code": "5678",
      "Image URL": "",
      "Availability": "yes",
      "Unit": "ltr",
      "Weight": "0.5"
    }
  ];

  // Create workbook
  const workbook = xlsx.utils.book_new();
  const worksheet = xlsx.utils.json_to_sheet(sampleData);

  // Set column widths
  worksheet['!cols'] = [
    { wch: 25 }, // Product Name
    { wch: 15 }, // Category
    { wch: 40 }, // Description
    { wch: 10 }, // MRP
    { wch: 12 }, // Selling Price
    { wch: 15 }, // Stock Quantity
    { wch: 10 }, // B2B Price
    { wch: 15 }, // B2B Min Quantity
    { wch: 10 }, // HSN Code
    { wch: 40 }, // Image URL
    { wch: 12 }, // Availability
    { wch: 8 },  // Unit
    { wch: 8 }   // Weight
  ];

  xlsx.utils.book_append_sheet(workbook, worksheet, "Products");

  // Write to buffer
  const buffer = xlsx.write(workbook, { type: "buffer", bookType: "xlsx" });

  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", "attachment; filename=product_upload_template.xlsx");
  res.send(buffer);
});

// ==================== BULK UPLOAD ====================

// Parse and validate uploaded file
export const parseUploadFile = catchAsyncError(async (req, res, next) => {
  if (!req.files || !req.files.file) {
    return next(new ErrorHandler("Please upload a file", 400));
  }

  const file = req.files.file;
  const fileExtension = path.extname(file.name).toLowerCase();

  if (![".xlsx", ".xls", ".csv"].includes(fileExtension)) {
    return next(new ErrorHandler("Invalid file format. Please upload .xlsx, .xls, or .csv file", 400));
  }

  try {
    // Parse file
    const workbook = xlsx.read(file.data, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const rawData = xlsx.utils.sheet_to_json(worksheet);

    if (rawData.length === 0) {
      return next(new ErrorHandler("File is empty or invalid format", 400));
    }

    // Get existing categories for validation
    const existingProducts = await Product.find({}, "productName");
    const existingProductNames = new Set(existingProducts.map(p => p.productName.toLowerCase()));

    // Validate and process each row
    const validatedData = [];
    const errors = [];
    const validCategories = [
      "Groceries", "Dairy", "Fruits", "Vegetables", "Beverages", 
      "Snacks", "Personal Care", "Household", "Baby Care", "Pet Supplies",
      "Frozen", "Bakery", "Meat & Seafood", "Organic", "Health & Wellness",
      "Spices", "Rice & Flour", "Oil & Ghee", "Pulses", "Biscuits & Cookies"
    ];

    rawData.forEach((row, index) => {
      const rowNumber = index + 2; // +2 because Excel is 1-indexed and has header
      const rowErrors = [];
      
      // Required field validation
      if (!row["Product Name"] || String(row["Product Name"]).trim() === "") {
        rowErrors.push("Product Name is required");
      }

      if (!row["Category"] || String(row["Category"]).trim() === "") {
        rowErrors.push("Category is required");
      } else {
        // Auto-map category (case-insensitive)
        const inputCategory = String(row["Category"]).trim();
        const matchedCategory = validCategories.find(
          c => c.toLowerCase() === inputCategory.toLowerCase()
        );
        if (!matchedCategory) {
          // Allow custom categories - just use the input
          row["Category"] = inputCategory;
        } else {
          row["Category"] = matchedCategory;
        }
      }

      // Numeric validation
      const mrp = parseFloat(row["MRP"]);
      const sellingPrice = parseFloat(row["Selling Price"]);
      const stockQty = parseInt(row["Stock Quantity"]);
      const b2bPrice = parseFloat(row["B2B Price"]) || 0;
      const b2bMinQty = parseInt(row["B2B Min Quantity"]) || 6;

      if (isNaN(mrp) || mrp <= 0) {
        rowErrors.push("MRP must be a positive number");
      }

      if (isNaN(sellingPrice) || sellingPrice <= 0) {
        rowErrors.push("Selling Price must be a positive number");
      }

      if (!isNaN(mrp) && !isNaN(sellingPrice) && sellingPrice > mrp) {
        rowErrors.push("Selling Price cannot be greater than MRP");
      }

      if (isNaN(stockQty) || stockQty < 0) {
        rowErrors.push("Stock Quantity must be a non-negative number");
      }

      // Duplicate check
      const productName = String(row["Product Name"] || "").trim().toLowerCase();
      if (productName && existingProductNames.has(productName)) {
        rowErrors.push("Product already exists in database");
      }

      // Build processed row
      const processedRow = {
        rowNumber,
        productName: String(row["Product Name"] || "").trim(),
        category: row["Category"],
        description: String(row["Description"] || "").trim(),
        mrp: mrp || 0,
        sellingPrice: sellingPrice || 0,
        stockQuantity: stockQty || 0,
        b2bPrice: b2bPrice,
        b2bMinQty: b2bMinQty,
        hsnCode: String(row["HSN Code"] || "").trim(),
        imageUrl: String(row["Image URL"] || "").trim(),
        availability: String(row["Availability"] || "yes").toLowerCase() === "yes",
        unit: String(row["Unit"] || "unit").trim(),
        weight: String(row["Weight"] || "1").trim(),
        errors: rowErrors,
        isValid: rowErrors.length === 0
      };

      validatedData.push(processedRow);
      
      if (rowErrors.length > 0) {
        errors.push({
          row: rowNumber,
          errors: rowErrors
        });
      }
    });

    const validCount = validatedData.filter(r => r.isValid).length;
    const invalidCount = validatedData.filter(r => !r.isValid).length;

    res.status(200).json({
      success: true,
      message: `Parsed ${rawData.length} rows: ${validCount} valid, ${invalidCount} invalid`,
      data: {
        totalRows: rawData.length,
        validRows: validCount,
        invalidRows: invalidCount,
        rows: validatedData,
        errors: errors,
        validCategories: validCategories
      }
    });
  } catch (error) {
    return next(new ErrorHandler(`Error parsing file: ${error.message}`, 500));
  }
});

// Execute bulk upload
export const executeBulkUpload = catchAsyncError(async (req, res, next) => {
  const { products } = req.body;

  if (!products || !Array.isArray(products) || products.length === 0) {
    return next(new ErrorHandler("No products to upload", 400));
  }

  const results = {
    success: [],
    failed: []
  };

  for (const product of products) {
    try {
      // Create product
      const newProduct = await Product.create({
        productName: product.productName,
        category: product.category,
        description: product.description,
        mrp: product.mrp,
        sellingPrice: product.sellingPrice,
        stockQuantity: product.stockQuantity,
        b2bPrice: product.b2bPrice || product.sellingPrice,
        b2bMinQty: product.b2bMinQty || 6,
        hsnCode: product.hsnCode,
        productImage: product.imageUrl || "",
        availability: product.availability !== false,
        unit: product.unit || "unit",
        weight: product.weight || "1"
      });

      results.success.push({
        productName: product.productName,
        id: newProduct._id
      });
    } catch (error) {
      results.failed.push({
        productName: product.productName,
        error: error.message
      });
    }
  }

  res.status(200).json({
    success: true,
    message: `Uploaded ${results.success.length} products, ${results.failed.length} failed`,
    data: {
      successCount: results.success.length,
      failedCount: results.failed.length,
      successProducts: results.success,
      failedProducts: results.failed
    }
  });
});

// ==================== BULK PRICE UPDATE ====================

// Get products for bulk price update
export const getProductsForPriceUpdate = catchAsyncError(async (req, res, next) => {
  const { category, search, page = 1, limit = 50 } = req.query;

  const filter = {};
  if (category && category !== "all") {
    filter.category = category;
  }
  if (search) {
    filter.productName = { $regex: search, $options: "i" };
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);
  
  const products = await Product.find(filter)
    .select("productName category mrp sellingPrice b2bPrice stockQuantity")
    .skip(skip)
    .limit(parseInt(limit))
    .sort({ productName: 1 });

  const total = await Product.countDocuments(filter);

  // Get unique categories
  const categories = await Product.distinct("category");

  res.status(200).json({
    success: true,
    data: {
      products,
      categories,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit))
      }
    }
  });
});

// Preview price changes
export const previewPriceUpdate = catchAsyncError(async (req, res, next) => {
  const { productIds, updateType, updateValue, priceField } = req.body;

  if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
    return next(new ErrorHandler("No products selected", 400));
  }

  if (!updateType || !["percentage", "fixed", "replace"].includes(updateType)) {
    return next(new ErrorHandler("Invalid update type", 400));
  }

  if (updateValue === undefined || updateValue === null) {
    return next(new ErrorHandler("Update value is required", 400));
  }

  const field = priceField || "sellingPrice"; // sellingPrice, mrp, b2bPrice

  const products = await Product.find({ _id: { $in: productIds } })
    .select("productName category mrp sellingPrice b2bPrice");

  const preview = products.map(product => {
    const currentPrice = product[field] || 0;
    let newPrice;

    switch (updateType) {
      case "percentage":
        // Positive = increase, Negative = decrease
        newPrice = currentPrice * (1 + parseFloat(updateValue) / 100);
        break;
      case "fixed":
        // Positive = increase, Negative = decrease
        newPrice = currentPrice + parseFloat(updateValue);
        break;
      case "replace":
        newPrice = parseFloat(updateValue);
        break;
      default:
        newPrice = currentPrice;
    }

    // Round to 2 decimal places
    newPrice = Math.max(0, Math.round(newPrice * 100) / 100);

    return {
      id: product._id,
      productName: product.productName,
      category: product.category,
      currentPrice: currentPrice,
      newPrice: newPrice,
      change: newPrice - currentPrice,
      changePercent: currentPrice > 0 ? ((newPrice - currentPrice) / currentPrice * 100).toFixed(2) : 0
    };
  });

  res.status(200).json({
    success: true,
    data: {
      field,
      updateType,
      updateValue,
      preview,
      totalProducts: preview.length
    }
  });
});

// Execute bulk price update
export const executePriceUpdate = catchAsyncError(async (req, res, next) => {
  const { updates, priceField } = req.body;

  if (!updates || !Array.isArray(updates) || updates.length === 0) {
    return next(new ErrorHandler("No updates to apply", 400));
  }

  const field = priceField || "sellingPrice";
  const results = {
    success: 0,
    failed: 0,
    errors: []
  };

  for (const update of updates) {
    try {
      const updateData = {};
      updateData[field] = update.newPrice;

      await Product.findByIdAndUpdate(update.id, updateData);
      results.success++;
    } catch (error) {
      results.failed++;
      results.errors.push({
        id: update.id,
        productName: update.productName,
        error: error.message
      });
    }
  }

  res.status(200).json({
    success: true,
    message: `Updated ${results.success} products, ${results.failed} failed`,
    data: results
  });
});

// ==================== BULK STOCK UPDATE ====================

// Get low stock products
export const getLowStockProducts = catchAsyncError(async (req, res, next) => {
  const { threshold = 10 } = req.query;

  const products = await Product.find({ stockQuantity: { $lte: parseInt(threshold) } })
    .select("productName category stockQuantity sellingPrice")
    .sort({ stockQuantity: 1 });

  res.status(200).json({
    success: true,
    data: {
      threshold: parseInt(threshold),
      count: products.length,
      products
    }
  });
});

// Parse stock update file
export const parseStockFile = catchAsyncError(async (req, res, next) => {
  if (!req.files || !req.files.file) {
    return next(new ErrorHandler("Please upload a file", 400));
  }

  const file = req.files.file;
  const fileExtension = path.extname(file.name).toLowerCase();

  if (![".xlsx", ".xls", ".csv"].includes(fileExtension)) {
    return next(new ErrorHandler("Invalid file format", 400));
  }

  try {
    const workbook = xlsx.read(file.data, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const rawData = xlsx.utils.sheet_to_json(worksheet);

    if (rawData.length === 0) {
      return next(new ErrorHandler("File is empty", 400));
    }

    // Get all products for matching
    const products = await Product.find({}, "productName stockQuantity");
    const productMap = new Map();
    products.forEach(p => productMap.set(p.productName.toLowerCase(), p));

    const validatedData = [];
    const errors = [];

    rawData.forEach((row, index) => {
      const rowNumber = index + 2;
      const rowErrors = [];

      const productName = String(row["Product Name"] || "").trim();
      const stockChange = parseInt(row["Stock Change"]) || 0;
      const updateType = String(row["Update Type"] || "add").toLowerCase();

      if (!productName) {
        rowErrors.push("Product Name is required");
      }

      const matchedProduct = productMap.get(productName.toLowerCase());
      if (!matchedProduct) {
        rowErrors.push("Product not found in database");
      }

      if (!["add", "reduce", "replace"].includes(updateType)) {
        rowErrors.push("Update Type must be: add, reduce, or replace");
      }

      const processedRow = {
        rowNumber,
        productName,
        productId: matchedProduct?._id,
        currentStock: matchedProduct?.stockQuantity || 0,
        stockChange,
        updateType,
        newStock: calculateNewStock(matchedProduct?.stockQuantity || 0, stockChange, updateType),
        errors: rowErrors,
        isValid: rowErrors.length === 0
      };

      validatedData.push(processedRow);

      if (rowErrors.length > 0) {
        errors.push({ row: rowNumber, errors: rowErrors });
      }
    });

    const validCount = validatedData.filter(r => r.isValid).length;

    res.status(200).json({
      success: true,
      data: {
        totalRows: rawData.length,
        validRows: validCount,
        invalidRows: rawData.length - validCount,
        rows: validatedData,
        errors
      }
    });
  } catch (error) {
    return next(new ErrorHandler(`Error parsing file: ${error.message}`, 500));
  }
});

// Download stock update template
export const downloadStockTemplate = catchAsyncError(async (req, res, next) => {
  const products = await Product.find({})
    .select("productName stockQuantity")
    .sort({ productName: 1 });

  const templateData = products.map(p => ({
    "Product Name": p.productName,
    "Current Stock": p.stockQuantity,
    "Stock Change": 0,
    "Update Type": "add"
  }));

  const workbook = xlsx.utils.book_new();
  const worksheet = xlsx.utils.json_to_sheet(templateData);

  worksheet['!cols'] = [
    { wch: 30 },
    { wch: 15 },
    { wch: 15 },
    { wch: 12 }
  ];

  xlsx.utils.book_append_sheet(workbook, worksheet, "Stock Update");

  const buffer = xlsx.write(workbook, { type: "buffer", bookType: "xlsx" });

  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", "attachment; filename=stock_update_template.xlsx");
  res.send(buffer);
});

// Execute bulk stock update
export const executeStockUpdate = catchAsyncError(async (req, res, next) => {
  const { updates } = req.body;

  if (!updates || !Array.isArray(updates) || updates.length === 0) {
    return next(new ErrorHandler("No updates to apply", 400));
  }

  const results = {
    success: 0,
    failed: 0,
    errors: []
  };

  for (const update of updates) {
    try {
      await Product.findByIdAndUpdate(update.productId, {
        stockQuantity: Math.max(0, update.newStock)
      });
      results.success++;
    } catch (error) {
      results.failed++;
      results.errors.push({
        productName: update.productName,
        error: error.message
      });
    }
  }

  res.status(200).json({
    success: true,
    message: `Updated ${results.success} products, ${results.failed} failed`,
    data: results
  });
});

// Manual bulk stock update (without file)
export const manualStockUpdate = catchAsyncError(async (req, res, next) => {
  const { productIds, updateType, stockValue } = req.body;

  if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
    return next(new ErrorHandler("No products selected", 400));
  }

  if (!["add", "reduce", "replace"].includes(updateType)) {
    return next(new ErrorHandler("Invalid update type", 400));
  }

  const results = {
    success: 0,
    failed: 0,
    updates: []
  };

  for (const productId of productIds) {
    try {
      const product = await Product.findById(productId);
      if (!product) continue;

      const oldStock = product.stockQuantity;
      const newStock = calculateNewStock(oldStock, parseInt(stockValue), updateType);
      
      product.stockQuantity = Math.max(0, newStock);
      await product.save();

      results.success++;
      results.updates.push({
        productName: product.productName,
        oldStock: oldStock,
        newStock: product.stockQuantity
      });
    } catch (error) {
      results.failed++;
    }
  }

  res.status(200).json({
    success: true,
    message: `Updated ${results.success} products`,
    data: results
  });
});

// Helper function
function calculateNewStock(currentStock, change, updateType) {
  switch (updateType) {
    case "add":
      return currentStock + change;
    case "reduce":
      return currentStock - change;
    case "replace":
      return change;
    default:
      return currentStock;
  }
}
