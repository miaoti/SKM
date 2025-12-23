# System Context: Current Shopify Backend Schema

I have set up the following Metaobjects and Metafields in my Shopify Admin. Please use these exact handles and data types when writing Liquid code or GraphQL queries.

## 1. Metaobject Definition: Vehicle

- **Type/Handle:** `custom.vehicle`
- **Purpose:** Stores Year/Make/Model data for fitment.
- **Storefront Access:** ENABLED

**Fields:**
- `year` (Integer) - e.g., 2023
- `make` (Single Line Text) - e.g., Ford
- `model` (Single Line Text) - e.g., Mustang
- `submodel` (Single Line Text) - e.g., GT
- `full_name` (Single Line Text) - Display Name. e.g., 2023 Ford Mustang GT

---

## 2. Product Metafields

### Fitment Data
- **Namespace & Key:** `custom.fits_vehicles`
- **Type:** List of Metaobject References (`List<custom.vehicle>`)
- **Purpose:** Links a product to multiple compatible vehicles.
- **Liquid Access:** `product.metafields.custom.fits_vehicles.value` (Returns an array of vehicle objects)

### Wholesale Pricing (Product-Level)
- **Namespace & Key:** `custom.b2b_price`
- **Type:** Decimal (`number_decimal`)
- **Purpose:** Automatically set to LOWEST variant B2B price when variants exist
- **Liquid Access:** `product.metafields.custom.b2b_price.value`

### Discount Pricing (Product-Level)
- **Namespace & Key:** `custom.discount_price`
- **Type:** Decimal (`number_decimal`)
- **Purpose:** Automatically set to LOWEST variant discount price when variants exist
- **Liquid Access:** `product.metafields.custom.discount_price.value`

---

## 3. Variant Metafields

### Wholesale Pricing (Variant-Level)
- **Namespace & Key:** `custom.b2b_price`
- **Type:** Decimal (`number_decimal`)
- **Owner Type:** `PRODUCTVARIANT`
- **Purpose:** B2B pricing for individual variants
- **Liquid Access:** `variant.metafields.custom.b2b_price.value`
- **Storefront Access:** ENABLED (required for Shopify Functions)

### Discount Pricing (Variant-Level)
- **Namespace & Key:** `custom.discount_price`
- **Type:** Decimal (`number_decimal`)
- **Owner Type:** `PRODUCTVARIANT`
- **Purpose:** Sale/discount price for individual variants
- **Liquid Access:** `variant.metafields.custom.discount_price.value`
- **Storefront Access:** ENABLED (required for Shopify Functions)

**Note:** Variant-level prices take priority over product-level prices.

---

## 4. Customer Logic

### B2B Tag Detection
- **Tags:** `b2b`, `wholesale`, `business` (case-insensitive)
- **Logic:** If `customer.tags` contains any of these tags, the customer is treated as B2B.

### Pricing Logic

**For B2B Customers:**
1. Check variant-level B2B price first, then product-level B2B price
2. Check variant-level discount price first, then product-level discount price
3. Compare B2B price vs discount price → show the LOWER one
4. If neither exists, show original price

**For Standard Customers:**
1. Check variant-level discount price first, then product-level discount price
2. If discount price exists and is lower than original, show discount price with "X% OFF" badge
3. If no discount, show original price

**Product Cards (Collection/Main Page):**
- Iterates through ALL variants to find lowest prices
- Shows lowest variant B2B price for B2B users
- Shows lowest variant discount price for all users
- Uses `is_product_card` parameter in price.liquid

---

## 5. Cloudflare Worker API

- **URL:** `https://skm-inventory-api.miaotingshuo.workers.dev`
- **Authentication:** `X-Admin-Key` header

### Key Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/products` | GET | List all products |
| `/products/{id}` | GET | Get product details with variants |
| `/products/{id}` | PUT | Update product |
| `/products/{id}/variants` | PUT | Update variants (price, SKU, inventory, B2B price, discount price) |
| `/products/{id}/variants` | POST | Create new variants |
| `/b2b/checkout` | POST | Create B2B checkout with wholesale pricing |
| `/b2b/cart-preview` | POST | Preview cart with B2B pricing |
| `/checkout/create` | POST | Universal checkout with addon pricing |
| `/setup/metafield-definitions` | POST | Ensure variant metafield definitions exist |

### Variant Update Payload
```json
{
  "variants": [
    {
      "id": "gid://shopify/ProductVariant/123",
      "price": "99.99",
      "sku": "SKU-001",
      "inventory": 10,
      "b2bPrice": "79.99",
      "discountPrice": "89.99"
    }
  ]
}
```

### Important: Variant-Based Pricing Logic

**When Creating/Updating Variants:**
1. System automatically calculates the LOWEST B2B price from all variants
2. Updates product-level `custom.b2b_price` metafield to this lowest value
3. System automatically calculates the LOWEST discount price from all variants
4. Updates product-level `custom.discount_price` metafield to this lowest value
5. Shopify's `price_min` automatically reflects the cheapest variant price

**Decimal Precision Fix:**
- Fixed `formatPrice()` function to avoid floating-point errors (e.g., 4599 → 4598.98)
- Now uses string manipulation for precise 2-decimal formatting
- Handles rounding correctly without precision loss

---

## 6. Cart Transform Extension (Shopify Functions)

- **Location:** `extensions/cart-transform/`
- **Purpose:** Applies discount pricing at checkout

### How It Works
1. Queries variant metafields (`custom.discount_price`, `custom.b2b_price`)
2. Falls back to product metafields if variant metafields don't exist
3. For standard customers: applies discount price if lower than original
4. For B2B customers: compares B2B vs discount price, uses lower

### Important Requirements
- Metafield definitions must exist for `PRODUCTVARIANT` owner type
- Storefront access must be enabled on definitions
- Use `/setup/metafield-definitions` endpoint to create definitions automatically

---

## 7. Admin Dashboard

- **Location:** `templates/page.admin-dashboard.liquid`
- **Features:**
  - Product management (create, update, delete)
  - Variant management with B2B price and discount price columns
  - Remove discount button (×) to clear variant discount price
  - Vehicle/fitment management
  - Customer management with B2B tagging
  - **NEW:** Automatic product-level metafield updates when variants are saved
  - **NEW:** Decimal-precise price input handling

---

## 8. Frontend Files

### Product Page
- `sections/main-product-precision.liquid` - Main product section with B2B/discount logic
- `snippets/buy-buttons-precision.liquid` - Add to cart with variant price switching
- `snippets/price.liquid` - Price display component with variant iteration logic

### Collection/Main Page
- `sections/showroom-masonry.liquid` - Main page product grid with price snippet
- `sections/main-collection.liquid` - Collection page with product cards
- **FIXED:** Now uses `{% render 'price' %}` instead of direct `product.price`

### Cart
- `snippets/cart-summary.liquid` - Cart totals with B2B/discount pricing
- `snippets/cart-item-price.liquid` - Individual item price display
- `snippets/cart-item-line-total.liquid` - Line item total with discount logic

### Customer Pages
- `sections/main-customer-login.liquid` - Login with technical "Access Terminal" theme
- `sections/main-customer-register.liquid` - Registration with "Driver Profile" theme
- `sections/main-customer-account.liquid` - Account dashboard ("My Garage")
- `sections/main-customer-addresses.liquid` - Address management ("Shipping Destinations")
- `sections/main-page-contact-custom.liquid` - Contact page with engineering theme

---

## 9. Recent Updates & Fixes

### Variant Pricing Implementation (Dec 2024)
- **Product-level metafields now auto-update** to lowest variant prices
- **Price.liquid snippet** iterates through variants for product cards
- **Showroom-masonry section** fixed to use price snippet instead of direct price
- **Decimal precision fix** in formatPrice function (4599 → 4598.98 issue resolved)

### Design Consistency
- **Technical automotive theme** throughout all pages
- **Red/black color scheme** (#CC0000, #111111)
- **Uppercase tracking typography** for headers
- **Garage/Driver terminology** for customer features
- **Performance metrics** display (dyno charts, specs)

### Mobile Responsiveness
- **Responsive grids** (1-4 columns based on screen size)
- **Mobile-optimized forms** and navigation
- **Touch-friendly buttons** and interactions
- **Adaptive sidebar** for admin dashboard
