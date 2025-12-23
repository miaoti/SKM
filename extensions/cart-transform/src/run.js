// @ts-check
/**
 * SKM Cart Transform Function
 * 
 * Applies discount pricing at checkout based on:
 * - Variant metafields (custom.discount_price) - checked first
 * - Product metafields (custom.discount_price) - fallback
 * 
 * For B2B customers, compares B2B price vs discount price and uses lower.
 * For standard customers, uses discount price if available.
 */

/**
 * @typedef {import("../generated/api").RunInput} RunInput
 * @typedef {import("../generated/api").FunctionRunResult} FunctionRunResult
 * @typedef {import("../generated/api").CartOperation} CartOperation
 */

/**
 * @param {RunInput} input
 * @returns {FunctionRunResult}
 */
export function run(input) {
  const operations = [];
  
  // For now, we'll apply discount pricing to all customers
  // B2B detection can be added later via customer metafield
  const isB2B = false; // Simplified - discount pricing works for everyone
  
  // Process each cart line
  for (const line of input.cart.lines) {
    if (!line.merchandise || line.merchandise.__typename !== "ProductVariant") {
      continue;
    }
    
    const variant = line.merchandise;
    if (!variant.price || !variant.price.amount) {
      continue;
    }
    
    const originalPrice = parseFloat(variant.price.amount);
    if (isNaN(originalPrice) || originalPrice <= 0) {
      continue;
    }
    
    // Get metafield prices - check variant-level first, then fall back to product-level
    // Variant discount price
    let discountPrice = null;
    if (variant.variantDiscountPrice?.value) {
      const parsed = parseFloat(variant.variantDiscountPrice.value);
      if (!isNaN(parsed) && parsed > 0) {
        discountPrice = parsed;
      }
    }
    // Fall back to product discount price
    if (discountPrice === null && variant.product?.discountPrice?.value) {
      const parsed = parseFloat(variant.product.discountPrice.value);
      if (!isNaN(parsed) && parsed > 0) {
        discountPrice = parsed;
      }
    }
    
    // Variant B2B price
    let b2bPrice = null;
    if (variant.variantB2bPrice?.value) {
      const parsed = parseFloat(variant.variantB2bPrice.value);
      if (!isNaN(parsed) && parsed > 0) {
        b2bPrice = parsed;
      }
    }
    // Fall back to product B2B price
    if (b2bPrice === null && variant.product?.b2bPrice?.value) {
      const parsed = parseFloat(variant.product.b2bPrice.value);
      if (!isNaN(parsed) && parsed > 0) {
        b2bPrice = parsed;
      }
    }
    
    let effectivePrice = originalPrice;
    
    if (isB2B) {
      // B2B pricing logic - compare B2B price vs discount price, use lower
      if (b2bPrice !== null && discountPrice !== null) {
        effectivePrice = Math.min(b2bPrice, discountPrice);
      } else if (b2bPrice !== null) {
        effectivePrice = b2bPrice;
      } else if (discountPrice !== null) {
        effectivePrice = discountPrice;
      }
    } else {
      // Standard customer pricing logic - use discount price if available
      if (discountPrice !== null && discountPrice < originalPrice) {
        effectivePrice = discountPrice;
      }
    }
    
    // Only add operation if price actually changed (and is lower)
    if (effectivePrice < originalPrice) {
      operations.push({
        update: {
          cartLineId: line.id,
          price: {
            adjustment: {
              fixedPricePerUnit: {
                amount: effectivePrice.toFixed(2)
              }
            }
          }
        }
      });
    }
  }
  
  return { operations };
}

