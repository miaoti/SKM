# SKM Cart Transform - B2B & Discount Pricing Function

This Shopify Function applies the correct pricing (B2B or Discount) at checkout based on:
1. Customer tags (b2b)
2. Product metafields (custom.b2b_price, custom.discount_price)

## Prerequisites

1. Shopify CLI installed: `npm install -g @shopify/cli`
2. A Shopify Partner account
3. A development store or production store

## Deployment Steps

### 1. Initialize Shopify App (if not already done)

```bash
cd extensions/cart-transform
shopify app init
```

### 2. Create the Cart Transform Extension

```bash
shopify app generate extension --type cart_transform --name skm-pricing
```

### 3. Copy the Function Code

Copy the contents of `src/run.js` into the generated extension's `src/run.js` file.

### 4. Update the Extension Configuration

Update the generated `shopify.extension.toml` with the configuration from `shopify.extension.toml` in this folder.

### 5. Deploy

```bash
shopify app deploy
```

### 6. Enable in Shopify Admin

After deployment:
1. Go to Shopify Admin → Settings → Checkout
2. Enable the "SKM B2B & Discount Pricing" function

## How It Works

1. **For B2B customers** (tagged 'b2b'):
   - If both b2b_price and discount_price exist → Uses the LOWER price
   - If only b2b_price exists → Uses b2b_price
   - If only discount_price exists → Uses discount_price

2. **For standard customers**:
   - If discount_price exists → Uses discount_price
   - Otherwise → Uses standard price (no modification)

## Alternative: Manual Automatic Discounts

If you prefer not to deploy a Shopify Function, you can set up automatic discounts manually:

1. Go to Shopify Admin → Discounts
2. Create a new Automatic Discount
3. Set:
   - Type: Percentage or Amount off products
   - Customer eligibility: Specific customer segments (create a B2B segment)
   - This will apply across all products

Note: Manual discounts cannot dynamically read metafields, so you'll need to set a fixed discount percentage.

