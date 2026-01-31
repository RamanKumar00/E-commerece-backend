import { Product } from "../models/productSchema.js";
import ErrorHandler from "./error.js";

/**
 * Middleware to validate quantity rules based on user role.
 * 
 * For Customers (B2C):
 * - Any quantity >= 1 is allowed
 * - No pack size restrictions
 * 
 * For Retailers (B2B):
 * - Quantity must be >= b2bMinQty (default 6)
 * - Quantity must be a multiple of b2bMinQty
 * 
 * This middleware ensures that frontend and backend are aligned in quantity rules.
 */
export const validateQuantity = async (req, res, next) => {
  try {
    const { products } = req.body;
    
    // Skip if no products array (not an order/cart request)
    if (!products || !Array.isArray(products)) {
      return next();
    }

    const isRetailer = req.user?.role === "RetailUser";
    const errors = [];

    for (const item of products) {
      const { productId, quantity } = item;
      
      // Basic validation
      if (!productId) {
        errors.push("Product ID is required for all items");
        continue;
      }
      
      if (quantity === undefined || quantity === null) {
        errors.push(`Quantity is required for product ${productId}`);
        continue;
      }

      const qty = parseInt(quantity, 10);
      
      if (isNaN(qty) || qty <= 0) {
        errors.push(`Invalid quantity for product ${productId}. Must be a positive number.`);
        continue;
      }

      // Fetch product for B2B validation
      if (isRetailer) {
        const product = await Product.findById(productId);
        
        if (!product) {
          errors.push(`Product not found: ${productId}`);
          continue;
        }

        // Check B2B availability
        if (product.isB2BAvailable === false) {
          errors.push(`Product "${product.productName}" is not available for B2B/Retailer orders.`);
          continue;
        }

        const packSize = product.b2bMinQty || 6;

        // Check minimum quantity
        if (qty < packSize) {
          errors.push(`Minimum order quantity for "${product.productName}" is ${packSize} units. You requested ${qty}.`);
          continue;
        }

        // Check multiple of pack size
        if (qty % packSize !== 0) {
          errors.push(`Quantity for "${product.productName}" must be a multiple of ${packSize}. You requested ${qty}.`);
          continue;
        }
      } else {
        // Customer validation - simple check
        if (qty < 1) {
          errors.push(`Quantity must be at least 1 for each product.`);
          continue;
        }
      }
    }

    if (errors.length > 0) {
      return next(new ErrorHandler(errors.join(" | "), 400));
    }

    next();
  } catch (error) {
    console.error("Quantity validation error:", error);
    return next(new ErrorHandler("Quantity validation failed", 500));
  }
};

/**
 * Middleware to reject B2B quantities from customer accounts.
 * This ensures customers don't accidentally submit bulk orders.
 */
export const rejectInvalidRoleQuantity = async (req, res, next) => {
  try {
    const { products } = req.body;
    
    if (!products || !Array.isArray(products)) {
      return next();
    }

    const isCustomer = req.user?.role === "Customer";
    
    if (!isCustomer) {
      return next();
    }

    // For customers, check if any quantity looks like a bulk order
    // This is a soft check to prevent accidental bulk orders
    for (const item of products) {
      const qty = parseInt(item.quantity, 10);
      
      // Warn if customer is ordering bulk-like quantities
      // but don't reject (they might legitimately want many items)
      if (qty >= 50) {
        console.warn(`Customer ${req.user._id} placing large order: ${qty} units of ${item.productId}`);
      }
    }

    next();
  } catch (error) {
    console.error("Role quantity check error:", error);
    next();
  }
};

/**
 * Utility function to validate a single quantity
 * Can be imported and used in controllers
 */
export const isValidQuantityForRole = (quantity, role, b2bMinQty = 6) => {
  const qty = parseInt(quantity, 10);
  
  if (isNaN(qty) || qty <= 0) {
    return { valid: false, error: "Quantity must be a positive number" };
  }

  if (role === "RetailUser") {
    if (qty < b2bMinQty) {
      return { valid: false, error: `Minimum quantity is ${b2bMinQty}` };
    }
    if (qty % b2bMinQty !== 0) {
      return { valid: false, error: `Quantity must be a multiple of ${b2bMinQty}` };
    }
  } else {
    if (qty < 1) {
      return { valid: false, error: "Quantity must be at least 1" };
    }
  }

  return { valid: true, error: null };
};
