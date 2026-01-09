// ============================================
// SKM INVENTORY MANAGER - CLOUDFLARE WORKER
// ============================================
// Full Product & Vehicle Management System
// Auth: X-Admin-Key header required
// ============================================

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Admin-Key, X-Customer-Signature",
};

// Helper: Return JSON response with CORS
function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

// Helper: Return error response
function errorResponse(message, status = 500) {
  return new Response(JSON.stringify({ success: false, error: message }), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

// Helper: Format price to 2 decimal places without floating-point errors
// Uses string manipulation to avoid JavaScript floating-point precision issues
function formatPrice(value) {
  if (value === null || value === undefined || value === '') return null;

  // Convert to string first to preserve the exact value
  const str = String(value).trim();

  // If it's already a clean decimal string, parse and format it carefully
  // Use a decimal-safe approach: work with the string representation
  if (str.includes('.')) {
    const parts = str.split('.');
    const intPart = parts[0];
    let decPart = parts[1] || '00';

    // Pad or truncate decimal part to 2 digits
    if (decPart.length < 2) {
      decPart = decPart.padEnd(2, '0');
    } else if (decPart.length > 2) {
      // Round the third digit
      const thirdDigit = parseInt(decPart[2]) || 0;
      let firstTwo = parseInt(decPart.substring(0, 2));
      if (thirdDigit >= 5) {
        firstTwo += 1;
      }
      // Handle carry-over (e.g., 99 + 1 = 100)
      if (firstTwo >= 100) {
        return String(parseInt(intPart) + 1) + '.00';
      }
      decPart = String(firstTwo).padStart(2, '0');
    }

    return intPart + '.' + decPart;
  } else {
    // No decimal point - it's a whole number
    return str + '.00';
  }
}

// ============================================
// MAIN ENTRY POINT
// ============================================
export default {
  async fetch(request, env) {
    // Handle CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    // Authentication check (skip for health check, B2B storefront, and public dealer endpoints)
    const publicPaths = ["/health", "/b2b/checkout", "/b2b/cart-preview", "/checkout/create", "/shop/profile", "/categories", "/dealers", "/apply-dealer", "/my-dealer"];
    const isPublicDealerPath = path.startsWith("/dealers/") && request.method === "GET";
    const isCustomerUpdate = path.startsWith("/customers/") && request.method === "PUT";

    if (!publicPaths.includes(path) && !isPublicDealerPath && !isCustomerUpdate) {
      const clientKey = request.headers.get("X-Admin-Key");
      if (clientKey !== env.ADMIN_SECRET) {
        return errorResponse("Unauthorized", 401);
      }
    }

    try {
      // Route handling
      switch (true) {
        // Health check (no auth required)
        case path === "/health":
          return jsonResponse({ status: "ok", timestamp: Date.now() });

        // ==========================================
        // VEHICLE ROUTES
        // ==========================================
        case path === "/vehicles" && request.method === "GET":
          return jsonResponse(await listVehicles(env));

        case path === "/vehicles/create" && request.method === "POST":
          const createVehicleBody = await request.json();
          return jsonResponse(await createVehicle(env, createVehicleBody.payload || createVehicleBody));

        case path.match(/^\/vehicles\/[^/]+$/) && request.method === "GET":
          const getVehicleId = path.split("/").pop();
          return jsonResponse(await getVehicle(env, getVehicleId));

        case path.match(/^\/vehicles\/[^/]+$/) && request.method === "PUT":
          const updateVehicleId = path.split("/").pop();
          const updateVehicleBody = await request.json();
          return jsonResponse(await updateVehicle(env, updateVehicleId, updateVehicleBody));

        case path.match(/^\/vehicles\/[^/]+$/) && request.method === "DELETE":
          const vehicleId = path.split("/").pop();
          return jsonResponse(await deleteVehicle(env, vehicleId));

        // ==========================================
        // CUSTOMER ROUTES
        // ==========================================
        case path === "/customers" && request.method === "GET":
          const customerQuery = url.searchParams.get("q") || "";
          return jsonResponse(await listCustomers(env, customerQuery));

        case path.match(/^\/customers\/[^/]+$/) && request.method === "GET":
          const getCustomerId = path.split("/").pop();
          return jsonResponse(await getCustomer(env, getCustomerId));

        case path.match(/^\/customers\/[^/]+$/) && request.method === "PUT":
          const updateCustomerId = path.split("/").pop();
          const updateCustomerBody = await request.json();
          const signature = request.headers.get("X-Customer-Signature");
          return jsonResponse(await updateCustomerProfile(env, updateCustomerId, updateCustomerBody, signature));

        case path.match(/^\/customers\/[^/]+\/tags$/) && request.method === "POST":
          const tagCustomerId = path.split("/")[2];
          const tagBody = await request.json();
          return jsonResponse(await addCustomerTags(env, tagCustomerId, tagBody.tags));

        case path.match(/^\/customers\/[^/]+\/tags$/) && request.method === "DELETE":
          const untagCustomerId = path.split("/")[2];
          const untagBody = await request.json();
          return jsonResponse(await removeCustomerTags(env, untagCustomerId, untagBody.tags));

        // ==========================================
        // CATEGORIES ROUTES (Product Types)
        // ==========================================
        case path === "/categories" && request.method === "GET":
          const vehicleIdParam = url.searchParams.get("vehicleId") || "";
          return jsonResponse(await listCategories(env, vehicleIdParam));

        // ==========================================
        // PRODUCT ROUTES
        // ==========================================
        case path === "/products" && request.method === "GET":
          const searchQuery = url.searchParams.get("q") || "";
          return jsonResponse(await listProducts(env, searchQuery));

        case path === "/products/create" && request.method === "POST":
          const createProductBody = await request.json();
          return jsonResponse(await createProduct(env, createProductBody));

        case path.match(/^\/products\/[^/]+$/) && request.method === "GET":
          const getProductId = path.split("/").pop();
          return jsonResponse(await getProduct(env, getProductId));

        case path.match(/^\/products\/[^/]+$/) && request.method === "PUT":
          const updateProductId = path.split("/").pop();
          const updateProductBody = await request.json();
          return jsonResponse(await updateProduct(env, updateProductId, updateProductBody));

        case path.match(/^\/products\/[^/]+$/) && request.method === "DELETE":
          const deleteProductId = path.split("/").pop();
          return jsonResponse(await deleteProduct(env, deleteProductId));

        case path === "/products/update-fitment" && request.method === "POST":
          const fitmentBody = await request.json();
          return jsonResponse(await updateProductFitment(env, fitmentBody));

        case path.match(/^\/products\/[^/]+\/fitment$/) && request.method === "DELETE":
          const removeFitmentProductId = path.split("/")[2];
          const removeFitmentBody = await request.json();
          return jsonResponse(await removeProductFitment(env, removeFitmentProductId, removeFitmentBody.vehicle_id));

        // ==========================================
        // MEDIA ROUTES
        // ==========================================
        // Create staged upload URL (for direct file upload)
        case path === "/media/staged-upload" && request.method === "POST":
          const stagedUploadBody = await request.json();
          return jsonResponse(await createStagedUpload(env, stagedUploadBody));

        case path.match(/^\/products\/[^/]+\/media$/) && request.method === "POST":
          const mediaProductId = path.split("/")[2];
          const mediaBody = await request.json();
          return jsonResponse(await addProductMedia(env, mediaProductId, mediaBody));

        case path.match(/^\/products\/[^/]+\/media\/[^/]+$/) && request.method === "DELETE":
          const deleteMediaProductId = path.split("/")[2];
          const mediaId = path.split("/")[4];
          return jsonResponse(await deleteProductMedia(env, deleteMediaProductId, mediaId));

        // ==========================================
        // SHOP PROFILE ROUTES
        // ==========================================
        case path === "/shop/profile" && request.method === "GET":
          return jsonResponse(await getShopProfile(env));

        case path === "/shop/profile" && request.method === "PUT":
          const profileBody = await request.json();
          return jsonResponse(await updateShopProfile(env, profileBody));

        case path === "/shop/logo/upload" && request.method === "POST":
          const formData = await request.formData();
          return jsonResponse(await uploadShopLogo(env, formData));

        // ==========================================
        // INVENTORY ROUTES
        // ==========================================
        case path.match(/^\/products\/[^/]+\/inventory$/) && request.method === "PUT":
          const invProductId = path.split("/")[2];
          const invBody = await request.json();
          return jsonResponse(await updateInventory(env, invProductId, invBody));

        // Enable inventory tracking for a product
        case path.match(/^\/products\/[^/]+\/enable-tracking$/) && request.method === "POST":
          const trackProductId = path.split("/")[2];
          return jsonResponse(await enableInventoryTracking(env, trackProductId));

        // ==========================================
        // SHIPPING ROUTES
        // ==========================================
        // Get all packages (custom + carrier)
        case path === "/shipping/packages" && request.method === "GET":
          return jsonResponse(await listPackages(env));

        // Create custom package
        case path === "/shipping/packages" && request.method === "POST":
          const createPkgBody = await request.json();
          return jsonResponse(await createPackage(env, createPkgBody));

        // Delete custom package
        case path.match(/^\/shipping\/packages\/[^/]+$/) && request.method === "DELETE":
          const deletePkgId = path.split("/").pop();
          return jsonResponse(await deletePackage(env, deletePkgId));

        // Set default package
        case path === "/shipping/packages/default" && request.method === "PUT":
          const defaultPkgBody = await request.json();
          return jsonResponse(await setDefaultPackage(env, defaultPkgBody.packageId));

        // Update product shipping info
        case path.match(/^\/products\/[^/]+\/shipping$/) && request.method === "PUT":
          const shippingProductId = path.split("/")[2];
          const shippingBody = await request.json();
          return jsonResponse(await updateProductShipping(env, shippingProductId, shippingBody));

        // ==========================================
        // VARIANT & OPTIONS ROUTES
        // ==========================================
        // Update product options and generate variants
        case path.match(/^\/products\/[^/]+\/options$/) && request.method === "PUT":
          const optionsProductId = path.split("/")[2];
          const optionsBody = await request.json();
          return jsonResponse(await updateProductOptions(env, optionsProductId, optionsBody));

        // Bulk update variants (price, sku, inventory, b2b price)
        case path.match(/^\/products\/[^/]+\/variants$/) && request.method === "PUT":
          const variantsProductId = path.split("/")[2];
          const variantsBody = await request.json();
          return jsonResponse(await updateProductVariants(env, variantsProductId, variantsBody));

        // Create product options and variants
        case path.match(/^\/products\/[^/]+\/variants$/) && request.method === "POST":
          const createVariantsProductId = path.split("/")[2];
          const createVariantsBody = await request.json();
          return jsonResponse(await createProductVariants(env, createVariantsProductId, createVariantsBody));

        // Update media alt text (for option tagging)
        case path.match(/^\/products\/[^/]+\/media\/[^/]+\/alt$/) && request.method === "PUT":
          const altMediaProductId = path.split("/")[2];
          const altMediaId = path.split("/")[4];
          const altBody = await request.json();
          return jsonResponse(await updateMediaAlt(env, altMediaProductId, altMediaId, altBody.alt));

        // Save add-on options as metafield
        case path.match(/^\/products\/[^/]+\/addons$/) && request.method === "PUT":
          const addonsProductId = path.split("/")[2];
          const addonsBody = await request.json();
          return jsonResponse(await saveProductAddOns(env, addonsProductId, addonsBody.addOnOptions));

        // ==========================================
        // B2B CHECKOUT ROUTES
        // ==========================================
        // Create a B2B checkout (draft order) with wholesale pricing
        case path === "/b2b/checkout" && request.method === "POST":
          const b2bCheckoutBody = await request.json();
          return jsonResponse(await createB2BCheckout(env, b2bCheckoutBody));

        // Preview cart with B2B pricing applied
        case path === "/b2b/cart-preview" && request.method === "POST":
          const cartPreviewBody = await request.json();
          return jsonResponse(await getB2BCartPreview(env, cartPreviewBody.customerId, cartPreviewBody.items));

        // ==========================================
        // UNIVERSAL CHECKOUT (handles addon pricing for all customers)
        // ==========================================
        case path === "/checkout/create" && request.method === "POST":
          const checkoutBody = await request.json();
          return jsonResponse(await createCheckoutWithAddons(env, checkoutBody));

        // ==========================================
        // METAFIELD DEFINITIONS (ensure variant metafields are accessible)
        // ==========================================
        case path === "/setup/metafield-definitions" && request.method === "POST":
          const b2bResult = await ensureVariantB2bPriceDefinition(env);
          const discountResult = await ensureVariantDiscountPriceDefinition(env);
          return jsonResponse({
            success: true,
            b2bPriceDefinition: b2bResult,
            discountPriceDefinition: discountResult,
            message: "Variant metafield definitions ensured for Shopify Functions access"
          });

        // ==========================================
        // ORDER MANAGEMENT ROUTES
        // ==========================================
        // List all orders with filtering
        case path === "/orders" && request.method === "GET":
          const orderStatus = url.searchParams.get("status") || "";
          const orderFulfillment = url.searchParams.get("fulfillment") || "";
          const orderFinancial = url.searchParams.get("financial") || "";
          const orderQuery = url.searchParams.get("q") || "";
          const orderLimit = parseInt(url.searchParams.get("limit")) || 50;
          return jsonResponse(await listOrders(env, { status: orderStatus, fulfillment: orderFulfillment, financial: orderFinancial, query: orderQuery, limit: orderLimit }));

        // Get single order with full details
        case path.match(/^\/orders\/[^/]+$/) && request.method === "GET":
          const getOrderId = path.split("/").pop();
          return jsonResponse(await getOrder(env, getOrderId));

        // Update order (notes, tags, shipping address)
        case path.match(/^\/orders\/[^/]+$/) && request.method === "PUT":
          const updateOrderId = path.split("/").pop();
          const updateOrderBody = await request.json();
          return jsonResponse(await updateOrder(env, updateOrderId, updateOrderBody));

        // Cancel order
        case path.match(/^\/orders\/[^/]+\/cancel$/) && request.method === "POST":
          const cancelOrderId = path.split("/")[2];
          const cancelBody = await request.json();
          return jsonResponse(await cancelOrder(env, cancelOrderId, cancelBody));

        // Close order
        case path.match(/^\/orders\/[^/]+\/close$/) && request.method === "POST":
          const closeOrderId = path.split("/")[2];
          return jsonResponse(await closeOrder(env, closeOrderId));

        // Reopen order
        case path.match(/^\/orders\/[^/]+\/open$/) && request.method === "POST":
          const reopenOrderId = path.split("/")[2];
          return jsonResponse(await reopenOrder(env, reopenOrderId));

        // Get fulfillment orders for an order
        case path.match(/^\/orders\/[^/]+\/fulfillment-orders$/) && request.method === "GET":
          const fulfillmentOrdersId = path.split("/")[2];
          return jsonResponse(await getFulfillmentOrders(env, fulfillmentOrdersId));

        // Create fulfillment
        case path === "/fulfillments" && request.method === "POST":
          const createFulfillmentBody = await request.json();
          return jsonResponse(await createFulfillment(env, createFulfillmentBody));

        // Update fulfillment tracking
        case path.match(/^\/fulfillments\/[^/]+\/tracking$/) && request.method === "PUT":
          const trackingFulfillmentId = path.split("/")[2];
          const trackingBody = await request.json();
          return jsonResponse(await updateFulfillmentTracking(env, trackingFulfillmentId, trackingBody));

        // Cancel fulfillment
        case path.match(/^\/fulfillments\/[^/]+\/cancel$/) && request.method === "POST":
          const cancelFulfillmentId = path.split("/")[2];
          return jsonResponse(await cancelFulfillment(env, cancelFulfillmentId));

        // Move fulfillment order to in progress
        case path.match(/^\/fulfillment-orders\/[^/]+\/move-to-in-progress$/) && request.method === "POST":
          const inProgressFoId = path.split("/")[2];
          return jsonResponse(await moveFulfillmentOrderToInProgress(env, inProgressFoId));

        // Hold fulfillment order
        case path.match(/^\/fulfillment-orders\/[^/]+\/hold$/) && request.method === "POST":
          const holdFoId = path.split("/")[2];
          const holdBody = await request.json();
          return jsonResponse(await holdFulfillmentOrder(env, holdFoId, holdBody));

        // Release fulfillment order hold
        case path.match(/^\/fulfillment-orders\/[^/]+\/release-hold$/) && request.method === "POST":
          const releaseFoId = path.split("/")[2];
          return jsonResponse(await releaseFulfillmentOrderHold(env, releaseFoId));

        // Add order note
        case path.match(/^\/orders\/[^/]+\/notes$/) && request.method === "POST":
          const noteOrderId = path.split("/")[2];
          const noteBody = await request.json();
          return jsonResponse(await addOrderNote(env, noteOrderId, noteBody));

        // Mark order as paid
        case path.match(/^\/orders\/[^/]+\/mark-paid$/) && request.method === "POST":
          const markPaidOrderId = path.split("/")[2];
          return jsonResponse(await markOrderAsPaid(env, markPaidOrderId));

        // Calculate refund (Stage 1)
        case path.match(/^\/orders\/[^/]+\/refund\/calculate$/) && request.method === "POST":
          const calcRefundOrderId = path.split("/")[2];
          const calcRefundBody = await request.json();
          return jsonResponse(await calculateRefund(env, calcRefundOrderId, calcRefundBody));

        // Execute refund (Stage 2)
        case path.match(/^\/orders\/[^/]+\/refund$/) && request.method === "POST":
          const refundOrderId = path.split("/")[2];
          const refundBody = await request.json();
          return jsonResponse(await executeRefund(env, refundOrderId, refundBody));

        // Get order timeline/events
        case path.match(/^\/orders\/[^/]+\/timeline$/) && request.method === "GET":
          const timelineOrderId = path.split("/")[2];
          return jsonResponse(await getOrderTimeline(env, timelineOrderId));

        // Get shipping rates for order
        case path.match(/^\/orders\/[^/]+\/shipping-rates$/) && request.method === "GET":
          const ratesOrderId = path.split("/")[2];
          return jsonResponse(await getShippingRates(env, ratesOrderId));

        // Send order confirmation email
        case path.match(/^\/orders\/[^/]+\/send-receipt$/) && request.method === "POST":
          const receiptOrderId = path.split("/")[2];
          return jsonResponse(await sendOrderReceipt(env, receiptOrderId));



        // ==========================================
        // DEALER MANAGEMENT ROUTES
        // ==========================================
        // Initialize dealer metaobject schemas (admin only)
        case path === "/schema/init-dealers" && request.method === "POST":
          return jsonResponse(await initDealerSchemas(env));

        // Backfill geocoding for existing dealers (admin only)
        case path.replace(/\/$/, "") === "/admin/backfill-geocoding" && request.method === "POST":
          return jsonResponse(await backfillGeocoding(env));

        // List all dealers (public: active only, admin: can filter)
        case path === "/dealers" && request.method === "GET":
          const dealerStatus = url.searchParams.get("status") || "active";

          // Security check: Only allow 'active' status without admin key
          if (dealerStatus !== "active") {
            const clientKey = request.headers.get("X-Admin-Key");
            if (clientKey !== env.ADMIN_SECRET) {
              return errorResponse("Unauthorized: Admin key required to view inactive dealers", 401);
            }
          }

          return jsonResponse(await listDealers(env, dealerStatus));

        // Get single dealer (public)
        case path.match(/^\/dealers\/[^/]+$/) && request.method === "GET":
          const getDealerId = decodeURIComponent(path.split("/").pop());
          return jsonResponse(await getDealer(env, getDealerId));

        // Create dealer (admin only)
        case path === "/dealers" && request.method === "POST":
          const createDealerBody = await request.json();
          return jsonResponse(await createDealer(env, createDealerBody));

        // Update dealer (admin or owner)
        case path.match(/^\/dealers\/[^/]+$/) && request.method === "PUT":
          const updateDealerId = decodeURIComponent(path.split("/").pop());
          const updateDealerBody = await request.json();
          return jsonResponse(await updateDealer(env, updateDealerId, updateDealerBody));

        // Delete dealer (admin only)
        case path.match(/^\/dealers\/[^/]+$/) && request.method === "DELETE":
          const deleteDealerId = decodeURIComponent(path.split("/").pop());
          return jsonResponse(await deleteDealer(env, deleteDealerId));

        // Apply to become a dealer (logged-in customer)
        case path === "/apply-dealer" && request.method === "POST":
          const applyDealerBody = await request.json();
          return jsonResponse(await applyForDealer(env, applyDealerBody));

        // List dealer applications (admin only)
        case path === "/dealer-applications" && request.method === "GET":
          const appStatus = url.searchParams.get("status") || "";
          return jsonResponse(await listDealerApplications(env, appStatus));

        // Get single application (admin only)
        case path.match(/^\/dealer-applications\/[^/]+$/) && request.method === "GET":
          const getAppId = path.split("/").pop();
          return jsonResponse(await getDealerApplication(env, getAppId));

        // Process application (approve/reject) - admin only
        case path === "/process-application" && request.method === "POST":
          const processBody = await request.json();
          return jsonResponse(await processApplication(env, processBody));

        // Get current customer's dealer profile (B2B only)
        case path === "/my-dealer" && request.method === "GET":
          const myDealerCustomerId = url.searchParams.get("customerId");
          return jsonResponse(await getMyDealer(env, myDealerCustomerId));

        // Update own dealer profile (B2B only)
        case path === "/my-dealer" && request.method === "PUT":
          const myDealerUpdateBody = await request.json();
          return jsonResponse(await updateMyDealer(env, myDealerUpdateBody));

        default:
          return errorResponse("Not Found", 404);
      }
    } catch (err) {
      console.error("Worker error:", err);
      return errorResponse(err.message, 500);
    }
  },
};

// ============================================
// VEHICLE OPERATIONS
// ============================================

async function listVehicles(env) {
  const query = `
    query ListVehicles($first: Int!) {
      metaobjects(type: "vehicle", first: $first) {
        edges {
          node {
            id
            handle
            fields {
              key
              value
            }
          }
        }
      }
    }
  `;

  const result = await shopifyGraphQL(env, query, { first: 250 });

  const vehicles = result.metaobjects.edges.map(({ node }) => {
    const vehicle = { id: node.id, handle: node.handle };
    node.fields.forEach((field) => {
      vehicle[field.key] = field.key === "year" ? parseInt(field.value, 10) : field.value;
    });
    return vehicle;
  });

  return { success: true, data: vehicles, count: vehicles.length };
}

async function createVehicle(env, data) {
  const handle = (data.full_name || `${data.year}-${data.make}-${data.model}-${data.submodel}`)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  const query = `
    mutation CreateVehicle($metaobject: MetaobjectCreateInput!) {
      metaobjectCreate(metaobject: $metaobject) {
        metaobject {
          id
          handle
          fields { key value }
        }
        userErrors { field message }
      }
    }
  `;

  const variables = {
    metaobject: {
      type: "vehicle",
      handle,
      fields: [
        { key: "year", value: String(data.year) },
        { key: "make", value: data.make },
        { key: "model", value: data.model },
        { key: "submodel", value: data.submodel || "" },
        { key: "full_name", value: data.full_name || `${data.year} ${data.make} ${data.model} ${data.submodel || ""}`.trim() }
      ]
    }
  };

  const result = await shopifyGraphQL(env, query, variables);

  if (result.metaobjectCreate.userErrors?.length > 0) {
    throw new Error(result.metaobjectCreate.userErrors.map(e => e.message).join(", "));
  }

  const metaobject = result.metaobjectCreate.metaobject;

  // Publish to all sales channels so it's visible via Storefront API
  let publishResult = null;
  let publishError = null;

  try {
    console.log('[CreateVehicle] Attempting to publish metaobject:', metaobject.id);
    publishResult = await publishMetaobjectToOnlineStore(env, metaobject.id);
    console.log('[CreateVehicle] Publish result:', JSON.stringify(publishResult));
  } catch (pubErr) {
    publishError = pubErr.message;
    console.error('[CreateVehicle] Failed to publish:', pubErr.message);
  }

  return {
    success: true,
    data: metaobject,
    publishStatus: publishResult ? 'published' : 'failed',
    publishResult: publishResult,
    publishError: publishError
  };
}

async function deleteVehicle(env, vehicleId) {
  const gid = vehicleId.startsWith("gid://") ? vehicleId : `gid://shopify/Metaobject/${vehicleId}`;

  const query = `
    mutation DeleteVehicle($id: ID!) {
      metaobjectDelete(id: $id) {
        deletedId
        userErrors { field message }
      }
    }
  `;

  const result = await shopifyGraphQL(env, query, { id: gid });

  if (result.metaobjectDelete.userErrors?.length > 0) {
    throw new Error(result.metaobjectDelete.userErrors.map(e => e.message).join(", "));
  }

  return { success: true, message: "Vehicle deleted" };
}

async function getVehicle(env, vehicleId) {
  const gid = vehicleId.startsWith("gid://") ? vehicleId : `gid://shopify/Metaobject/${vehicleId}`;

  const query = `
    query GetVehicle($id: ID!) {
      metaobject(id: $id) {
        id
        handle
        type
        fields { key value }
        updatedAt
      }
    }
  `;

  const result = await shopifyGraphQL(env, query, { id: gid });

  if (!result.metaobject) {
    throw new Error("Vehicle not found");
  }

  const v = { id: result.metaobject.id, handle: result.metaobject.handle };
  result.metaobject.fields.forEach(f => {
    v[f.key] = f.key === "year" ? parseInt(f.value, 10) : f.value;
  });

  return { success: true, data: v };
}

async function updateVehicle(env, vehicleId, data) {
  const gid = vehicleId.startsWith("gid://") ? vehicleId : `gid://shopify/Metaobject/${vehicleId}`;

  // Build fields array from provided data
  const fields = [];
  if (data.year !== undefined) fields.push({ key: "year", value: String(data.year) });
  if (data.make !== undefined) fields.push({ key: "make", value: data.make });
  if (data.model !== undefined) fields.push({ key: "model", value: data.model });
  if (data.submodel !== undefined) fields.push({ key: "submodel", value: data.submodel });
  if (data.full_name !== undefined) fields.push({ key: "full_name", value: data.full_name });

  // Auto-generate full_name if not provided but other fields are
  if (!data.full_name && (data.year || data.make || data.model)) {
    const fullName = [data.year, data.make, data.model, data.submodel].filter(Boolean).join(' ');
    fields.push({ key: "full_name", value: fullName });
  }

  const query = `
    mutation UpdateVehicle($id: ID!, $metaobject: MetaobjectUpdateInput!) {
      metaobjectUpdate(id: $id, metaobject: $metaobject) {
        metaobject {
          id
          handle
          fields { key value }
        }
        userErrors { field message }
      }
    }
  `;

  const result = await shopifyGraphQL(env, query, {
    id: gid,
    metaobject: { fields }
  });

  if (result.metaobjectUpdate.userErrors?.length > 0) {
    throw new Error(result.metaobjectUpdate.userErrors.map(e => e.message).join(", "));
  }

  return { success: true, data: result.metaobjectUpdate.metaobject };
}

// ============================================
// CUSTOMER OPERATIONS
// ============================================

async function listCustomers(env, searchQuery = "") {
  const query = `
    query ListCustomers($first: Int!, $query: String) {
      customers(first: $first, query: $query) {
        edges {
          node {
            id
            email
            firstName
            lastName
            displayName
            phone
            state
            tags
            numberOfOrders
            amountSpent { amount currencyCode }
            createdAt
            defaultAddress {
              address1
              city
              province
              country
              zip
            }
          }
        }
      }
    }
  `;

  const result = await shopifyGraphQL(env, query, {
    first: 100,
    query: searchQuery || null
  });

  const customers = result.customers.edges.map(({ node }) => ({
    id: node.id,
    email: node.email,
    firstName: node.firstName,
    lastName: node.lastName,
    displayName: node.displayName,
    phone: node.phone,
    state: node.state,
    tags: node.tags,
    ordersCount: node.numberOfOrders,
    totalSpent: node.amountSpent?.amount,
    currency: node.amountSpent?.currencyCode,
    createdAt: node.createdAt,
    address: node.defaultAddress
  }));

  return { success: true, data: customers, count: customers.length };
}

async function getCustomer(env, customerId) {
  const gid = customerId.startsWith("gid://") ? customerId : `gid://shopify/Customer/${customerId}`;

  const query = `
    query GetCustomer($id: ID!) {
      customer(id: $id) {
        id
        email
        firstName
        lastName
        displayName
        phone
        state
        tags
        note
        taxExempt
        numberOfOrders
        amountSpent { amount currencyCode }
        createdAt
        updatedAt
        defaultAddress {
          id
          address1
          address2
          city
          province
          provinceCode
          country
          countryCodeV2
          zip
          phone
          company
        }
        addresses {
          id
          address1
          address2
          city
          province
          country
          zip
          phone
          company
        }
        orders(first: 10) {
          edges {
            node {
              id
              name
              createdAt
              totalPriceSet { shopMoney { amount currencyCode } }
              displayFulfillmentStatus
              displayFinancialStatus
            }
          }
        }
      }
    }
  `;

  const result = await shopifyGraphQL(env, query, { id: gid });

  if (!result.customer) {
    throw new Error("Customer not found");
  }

  const c = result.customer;
  return {
    success: true,
    data: {
      id: c.id,
      email: c.email,
      firstName: c.firstName,
      lastName: c.lastName,
      displayName: c.displayName,
      phone: c.phone,
      state: c.state,
      tags: c.tags,
      note: c.note,
      taxExempt: c.taxExempt,
      ordersCount: c.numberOfOrders,
      totalSpent: c.amountSpent?.amount,
      currency: c.amountSpent?.currencyCode,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
      defaultAddress: c.defaultAddress,
      addresses: c.addresses,
      recentOrders: c.orders.edges.map(({ node }) => ({
        id: node.id,
        name: node.name,
        createdAt: node.createdAt,
        total: node.totalPriceSet?.shopMoney?.amount,
        currency: node.totalPriceSet?.shopMoney?.currencyCode,
        fulfillment: node.displayFulfillmentStatus,
        financial: node.displayFinancialStatus
      }))
    }
  };
}

async function updateCustomer(env, customerId, data) {
  const gid = customerId.startsWith("gid://") ? customerId : `gid://shopify/Customer/${customerId}`;

  const query = `
    mutation UpdateCustomer($input: CustomerInput!) {
      customerUpdate(input: $input) {
        customer {
          id
          email
          firstName
          lastName
          tags
        }
        userErrors { field message }
      }
    }
  `;

  const input = { id: gid };
  if (data.email !== undefined) input.email = data.email;
  if (data.firstName !== undefined) input.firstName = data.firstName;
  if (data.lastName !== undefined) input.lastName = data.lastName;
  if (data.phone !== undefined) input.phone = data.phone;
  if (data.note !== undefined) input.note = data.note;
  if (data.tags !== undefined) input.tags = data.tags;
  if (data.taxExempt !== undefined) input.taxExempt = data.taxExempt;

  const result = await shopifyGraphQL(env, query, { input });

  if (result.customerUpdate.userErrors?.length > 0) {
    throw new Error(result.customerUpdate.userErrors.map(e => e.message).join(", "));
  }

  return { success: true, data: result.customerUpdate.customer };
}

async function addCustomerTags(env, customerId, tags) {
  const gid = customerId.startsWith("gid://") ? customerId : `gid://shopify/Customer/${customerId}`;

  const query = `
    mutation AddTags($id: ID!, $tags: [String!]!) {
      tagsAdd(id: $id, tags: $tags) {
        node { ... on Customer { id tags } }
        userErrors { field message }
      }
    }
  `;

  const result = await shopifyGraphQL(env, query, { id: gid, tags: Array.isArray(tags) ? tags : [tags] });

  if (result.tagsAdd.userErrors?.length > 0) {
    throw new Error(result.tagsAdd.userErrors.map(e => e.message).join(", "));
  }

  return { success: true, data: result.tagsAdd.node };
}

async function removeCustomerTags(env, customerId, tags) {
  const gid = customerId.startsWith("gid://") ? customerId : `gid://shopify/Customer/${customerId}`;

  const query = `
    mutation RemoveTags($id: ID!, $tags: [String!]!) {
      tagsRemove(id: $id, tags: $tags) {
        node { ... on Customer { id tags } }
        userErrors { field message }
      }
    }
  `;

  const result = await shopifyGraphQL(env, query, { id: gid, tags: Array.isArray(tags) ? tags : [tags] });

  if (result.tagsRemove.userErrors?.length > 0) {
    throw new Error(result.tagsRemove.userErrors.map(e => e.message).join(", "));
  }

  return { success: true, data: result.tagsRemove.node };
}

// ============================================
// CATEGORY OPERATIONS (Product Types)
// ============================================

async function listCategories(env, vehicleId = "") {
  // If vehicleId is provided, filter products by vehicle fitment
  if (vehicleId) {
    return await listCategoriesForVehicle(env, vehicleId);
  }

  // Standard: Fetch all products to extract unique product types
  const query = `
    query ListProductTypes($first: Int!, $after: String) {
      products(first: $first, after: $after) {
        edges {
          node {
            productType
          }
        }
        pageInfo {
          hasNextPage
          endCursor
        }
      }
    }
  `;

  const typeCounts = {};
  let hasNextPage = true;
  let cursor = null;

  // Paginate through all products to get complete type counts
  while (hasNextPage) {
    const result = await shopifyGraphQL(env, query, { first: 250, after: cursor });

    for (const edge of result.products.edges) {
      const type = edge.node.productType;
      if (type && type.trim() !== '') {
        const normalizedType = type.trim();
        typeCounts[normalizedType] = (typeCounts[normalizedType] || 0) + 1;
      }
    }

    hasNextPage = result.products.pageInfo.hasNextPage;
    cursor = result.products.pageInfo.endCursor;
  }

  // Convert to array and sort by count (descending)
  const categories = Object.entries(typeCounts)
    .map(([name, count]) => ({
      name,
      count,
      handle: name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    }))
    .sort((a, b) => b.count - a.count);

  return { success: true, data: categories, count: categories.length };
}

/**
 * List categories filtered by products that fit a specific vehicle
 */
async function listCategoriesForVehicle(env, vehicleId) {
  // Query products with fits_vehicles metafield using Admin API syntax
  const query = `
    query ListProductTypesForVehicle($first: Int!, $after: String) {
      products(first: $first, after: $after) {
        edges {
          node {
            productType
            metafield(namespace: "custom", key: "fits_vehicles") {
              value
            }
          }
        }
        pageInfo {
          hasNextPage
          endCursor
        }
      }
    }
  `;

  const typeCounts = {};
  let hasNextPage = true;
  let cursor = null;

  // Paginate through products and filter by vehicle fitment
  while (hasNextPage) {
    const result = await shopifyGraphQL(env, query, {
      first: 250,
      after: cursor
    });

    for (const edge of result.products.edges) {
      // Check if product has fits_vehicles metafield containing the vehicle ID
      const fitsVehicles = edge.node.metafield?.value || "";
      if (fitsVehicles.includes(vehicleId)) {
        const type = edge.node.productType;
        if (type && type.trim() !== '') {
          const normalizedType = type.trim();
          typeCounts[normalizedType] = (typeCounts[normalizedType] || 0) + 1;
        }
      }
    }

    hasNextPage = result.products.pageInfo.hasNextPage;
    cursor = result.products.pageInfo.endCursor;
  }

  // Convert to array and sort by count (descending)
  const categories = Object.entries(typeCounts)
    .map(([name, count]) => ({
      name,
      count,
      handle: name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    }))
    .sort((a, b) => b.count - a.count);

  return { success: true, data: categories, count: categories.length, vehicleFiltered: true };
}

// ============================================
// PRODUCT OPERATIONS
// ============================================

async function listProducts(env, searchQuery = "") {
  const query = `
    query ListProducts($first: Int!, $query: String) {
      products(first: $first, query: $query) {
        edges {
          node {
            id
            title
            handle
            status
            descriptionHtml
            vendor
            productType
            tags
            priceRangeV2 {
              minVariantPrice { amount currencyCode }
              maxVariantPrice { amount currencyCode }
            }
            totalInventory
            featuredImage {
              url(transform: { maxWidth: 200 })
            }
            images(first: 10) {
              edges {
                node {
                  id
                  url(transform: { maxWidth: 400 })
                  altText
                }
              }
            }
            variants(first: 10) {
              edges {
                node {
                  id
                  title
                  price
                  compareAtPrice
                  sku
                  inventoryQuantity
                }
              }
            }
            metafield(namespace: "custom", key: "fits_vehicles") {
              id
              value
            }
          }
        }
      }
    }
  `;

  const result = await shopifyGraphQL(env, query, { first: 50, query: searchQuery || null });

  const products = result.products.edges.map(({ node }) => ({
    id: node.id,
    title: node.title,
    handle: node.handle,
    status: node.status,
    description: node.descriptionHtml,
    vendor: node.vendor,
    productType: node.productType,
    tags: node.tags,
    price: node.priceRangeV2?.minVariantPrice?.amount,
    compareAtPrice: node.variants.edges[0]?.node?.compareAtPrice,
    currency: node.priceRangeV2?.minVariantPrice?.currencyCode,
    inventory: node.totalInventory,
    image: node.featuredImage?.url,
    images: node.images.edges.map(e => ({ id: e.node.id, url: e.node.url, alt: e.node.altText })),
    variants: node.variants.edges.map(e => ({
      id: e.node.id,
      title: e.node.title,
      price: e.node.price,
      compareAtPrice: e.node.compareAtPrice,
      sku: e.node.sku,
      inventory: e.node.inventoryQuantity
    })),
    fitments: node.metafield ? JSON.parse(node.metafield.value || "[]") : []
  }));

  return { success: true, data: products, count: products.length };
}

async function getProduct(env, productId) {
  const gid = productId.startsWith("gid://") ? productId : `gid://shopify/Product/${productId}`;

  const query = `
    query GetProduct($id: ID!) {
      product(id: $id) {
        id
        title
        handle
        status
        descriptionHtml
        vendor
        productType
        tags
        priceRangeV2 {
          minVariantPrice { amount currencyCode }
        }
        totalInventory
        featuredImage { url }
        options {
          id
          name
          position
          values
        }
        images(first: 20) {
          edges {
            node {
              id
              url
              altText
            }
          }
        }
        media(first: 50) {
          edges {
            node {
              ... on MediaImage {
                id
                image { url altText }
                mediaContentType
                alt
              }
              ... on Video {
                id
                sources { url mimeType }
                mediaContentType
                alt
                preview {
                  image { url }
                }
              }
              ... on ExternalVideo {
                id
                embedUrl
                mediaContentType
                alt
                preview {
                  image { url }
                }
              }
            }
          }
        }
        variants(first: 100) {
          edges {
            node {
              id
              title
              price
              compareAtPrice
              sku
              inventoryQuantity
              selectedOptions {
                name
                value
              }
              inventoryItem { 
                id 
                tracked
                requiresShipping
                measurement {
                  weight {
                    value
                    unit
                  }
                }
              }
              b2bPrice: metafield(namespace: "custom", key: "b2b_price") {
                id
                value
              }
              discountPrice: metafield(namespace: "custom", key: "discount_price") {
                id
                value
              }
            }
          }
        }
        metafield(namespace: "custom", key: "fits_vehicles") {
          id
          value
          references(first: 50) {
            edges {
              node {
                ... on Metaobject {
                  id
                  handle
                  fields { key value }
                }
              }
            }
          }
        }
        b2bPrice: metafield(namespace: "custom", key: "b2b_price") {
          id
          value
        }
        discountPrice: metafield(namespace: "custom", key: "discount_price") {
          id
          value
        }
        addonOptions: metafield(namespace: "custom", key: "add_on_options") {
          id
          value
        }
      }
    }
  `;

  const result = await shopifyGraphQL(env, query, { id: gid });

  if (!result.product) {
    throw new Error("Product not found");
  }

  const p = result.product;

  // Debug logging for metafields
  console.log("Product b2bPrice metafield:", p.b2bPrice);

  const fitments = p.metafield?.references?.edges.map(({ node }) => {
    const v = { id: node.id, handle: node.handle };
    node.fields.forEach(f => { v[f.key] = f.key === "year" ? parseInt(f.value, 10) : f.value; });
    return v;
  }) || [];

  return {
    success: true,
    data: {
      id: p.id,
      title: p.title,
      handle: p.handle,
      status: p.status,
      description: p.descriptionHtml,
      vendor: p.vendor,
      productType: p.productType,
      tags: p.tags,
      price: p.priceRangeV2?.minVariantPrice?.amount,
      currency: p.priceRangeV2?.minVariantPrice?.currencyCode,
      inventory: p.totalInventory,
      image: p.featuredImage?.url,
      options: p.options?.map(o => ({
        id: o.id,
        name: o.name,
        position: o.position,
        values: o.values
      })) || [],
      images: p.images.edges.map(e => ({ id: e.node.id, url: e.node.url, alt: e.node.altText })),
      media: p.media.edges.map(e => ({
        id: e.node.id,
        mediaContentType: e.node.mediaContentType,
        type: e.node.mediaContentType,
        url: e.node.image?.url || e.node.preview?.image?.url || e.node.embedUrl,
        alt: e.node.image?.altText || e.node.alt,
        sources: e.node.sources || [],
        preview_image: e.node.preview?.image ? { url: e.node.preview.image.url } : null,
        previewImage: e.node.preview?.image ? { url: e.node.preview.image.url } : null
      })),
      variants: p.variants.edges.map(e => ({
        id: e.node.id,
        title: e.node.title,
        price: e.node.price,
        compareAtPrice: e.node.compareAtPrice,
        sku: e.node.sku,
        inventory: e.node.inventoryQuantity,
        selectedOptions: e.node.selectedOptions || [],
        inventoryItemId: e.node.inventoryItem?.id,
        inventoryTracked: e.node.inventoryItem?.tracked ?? false,
        requiresShipping: e.node.inventoryItem?.requiresShipping ?? true,
        weight: e.node.inventoryItem?.measurement?.weight?.value ?? 0,
        weightUnit: e.node.inventoryItem?.measurement?.weight?.unit ?? 'POUNDS',
        b2bPrice: e.node.b2bPrice?.value || null,
        discountPrice: e.node.discountPrice?.value || null
      })),
      hasVariants: p.variants.edges.length > 1 || (p.options?.length > 0 && p.options[0]?.name !== 'Title'),
      inventoryTracked: p.variants.edges[0]?.node?.inventoryItem?.tracked ?? false,
      requiresShipping: p.variants.edges[0]?.node?.inventoryItem?.requiresShipping ?? true,
      weight: p.variants.edges[0]?.node?.inventoryItem?.measurement?.weight?.value ?? 0,
      weightUnit: p.variants.edges[0]?.node?.inventoryItem?.measurement?.weight?.unit ?? 'POUNDS',
      b2bPrice: p.b2bPrice?.value || null,
      discountPrice: p.discountPrice?.value || null,
      addonOptions: p.addonOptions?.value ? JSON.parse(p.addonOptions.value) : [],
      fitments
    }
  };
}

async function createProduct(env, data) {
  // Step 1: Create product (without variants - Shopify creates a default one)
  const createQuery = `
    mutation CreateProduct($input: ProductInput!, $media: [CreateMediaInput!]) {
      productCreate(input: $input, media: $media) {
        product {
          id
          title
          handle
          variants(first: 1) {
            edges {
              node {
                id
                inventoryItem {
                  id
                }
              }
            }
          }
        }
        userErrors { field message }
      }
    }
  `;

  // Build metafields for B2B and discount prices
  const metafields = [];

  if (data.b2bPrice) {
    metafields.push({
      namespace: "custom",
      key: "b2b_price",
      type: "number_decimal",
      value: formatPrice(data.b2bPrice)
    });
  }

  if (data.discountPrice) {
    metafields.push({
      namespace: "custom",
      key: "discount_price",
      type: "number_decimal",
      value: formatPrice(data.discountPrice)
    });
  }

  const createVariables = {
    input: {
      title: data.title,
      descriptionHtml: data.description || "",
      vendor: data.vendor || "",
      productType: data.productType || "",
      tags: data.tags || [],
      status: data.status || "DRAFT",
      metafields: metafields.length > 0 ? metafields : undefined
    },
    media: data.mediaUrls?.map(url => ({
      originalSource: url,
      mediaContentType: url.match(/\.(mp4|mov|webm)$/i) ? "VIDEO" : "IMAGE"
    })) || []
  };

  const createResult = await shopifyGraphQL(env, createQuery, createVariables);

  if (createResult.productCreate.userErrors?.length > 0) {
    throw new Error(createResult.productCreate.userErrors.map(e => e.message).join(", "));
  }

  const product = createResult.productCreate.product;
  const variantId = product.variants?.edges?.[0]?.node?.id;
  const inventoryItemId = product.variants?.edges?.[0]?.node?.inventoryItem?.id;

  // Step 2: Update the default variant with price, SKU, etc.
  if (variantId) {
    const price = parseFloat(data.price) || 0;
    const compareAtPrice = data.compareAtPrice ? parseFloat(data.compareAtPrice) : null;
    const discountPrice = data.discountPrice ? parseFloat(data.discountPrice) : null;

    // If discount price is set and lower than price, use it as the actual price
    let finalPrice = price;
    let finalCompareAt = compareAtPrice;

    if (discountPrice && discountPrice > 0 && discountPrice < price) {
      finalPrice = discountPrice;
      finalCompareAt = price; // Original price becomes compare_at
    }

    const variantUpdateQuery = `
      mutation UpdateVariants($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
        productVariantsBulkUpdate(productId: $productId, variants: $variants) {
          productVariants { id price compareAtPrice sku }
          userErrors { field message }
        }
      }
    `;

    const variantInput = {
      id: variantId,
      price: formatPrice(finalPrice)
    };

    if (finalCompareAt) {
      variantInput.compareAtPrice = formatPrice(finalCompareAt);
    }

    if (data.sku) {
      variantInput.sku = data.sku;
    }

    await shopifyGraphQL(env, variantUpdateQuery, {
      productId: product.id,
      variants: [variantInput]
    });

    // Set inventory tracking and shipping info
    if (inventoryItemId) {
      const shouldTrack = data.trackInventory !== false;
      const requiresShipping = data.requiresShipping !== false;

      try {
        const trackingQuery = `
          mutation UpdateInventoryItem($id: ID!, $input: InventoryItemInput!) {
            inventoryItemUpdate(id: $id, input: $input) {
              userErrors { field message }
            }
          }
        `;

        const inventoryInput = {
          tracked: shouldTrack,
          requiresShipping: requiresShipping
        };

        // Add weight if provided
        if (data.weight !== undefined && data.weightUnit) {
          inventoryInput.measurement = {
            weight: {
              value: parseFloat(data.weight) || 0,
              unit: data.weightUnit // GRAMS, KILOGRAMS, OUNCES, POUNDS
            }
          };
        }

        await shopifyGraphQL(env, trackingQuery, {
          id: inventoryItemId,
          input: inventoryInput
        });
      } catch (trackErr) {
        console.error('[CreateProduct] Failed to set tracking/shipping:', trackErr.message);
      }
    }
  }

  // Step 3: Update inventory if specified (any value including 0)
  if (data.inventory !== undefined && inventoryItemId) {
    try {
      const qty = parseInt(data.inventory) || 0;
      console.log('[CreateProduct] Setting inventory to:', qty, 'for item:', inventoryItemId);
      await setInventoryQuantity(env, inventoryItemId, qty);
    } catch (invErr) {
      console.error('[CreateProduct] Failed to set inventory:', invErr.message);
    }
  }

  // Step 4: Publish product to Online Store sales channel (if status is ACTIVE)
  const statusUpper = (data.status || "").toUpperCase();
  console.log('[CreateProduct] Status check:', data.status, '-> uppercase:', statusUpper);

  let publishResult = null;
  let publishError = null;

  if (statusUpper === "ACTIVE") {
    try {
      console.log('[CreateProduct] Attempting to publish product:', product.id);
      publishResult = await publishProductToOnlineStore(env, product.id);
      console.log('[CreateProduct] Published to Online Store successfully');
    } catch (pubErr) {
      publishError = pubErr.message;
      console.error('[CreateProduct] Failed to publish to Online Store:', pubErr.message, pubErr.stack);
    }
  } else {
    console.log('[CreateProduct] Skipping publish - status is not ACTIVE:', statusUpper);
  }

  return {
    success: true,
    data: product,
    productId: product.id.split('/').pop(),
    publishStatus: publishResult ? 'published' : (publishError ? 'failed' : 'skipped'),
    publishError: publishError
  };
}

// Publish a product to ALL sales channels
async function publishProductToOnlineStore(env, productId) {
  const gid = productId.startsWith("gid://") ? productId : `gid://shopify/Product/${productId}`;
  const numericId = gid.split("/").pop();

  console.log('[Publish] Starting publish for product:', gid, 'numericId:', numericId);

  // Get all available publications/sales channels
  const pubQuery = `
    query GetPublications {
      publications(first: 20) {
        edges {
          node {
            id
            name
          }
        }
      }
    }
  `;

  const pubResult = await shopifyGraphQL(env, pubQuery, {});
  const publications = pubResult.publications?.edges || [];

  console.log('[Publish] Available publications:', JSON.stringify(publications.map(e => ({ id: e.node.id, name: e.node.name }))));

  if (publications.length === 0) {
    console.log('[Publish] No publications found, using REST API');
    return await publishProductViaREST(env, numericId);
  }

  // Publish to EACH channel individually using publishablePublish
  let successCount = 0;
  const errors = [];

  for (const { node } of publications) {
    try {
      console.log('[Publish] Publishing to channel:', node.name, node.id);

      const publishQuery = `
        mutation PublishToChannel($id: ID!, $input: [PublicationInput!]!) {
          publishablePublish(id: $id, input: $input) {
            publishable {
              ... on Product {
                id
              }
            }
            userErrors {
              field
              message
            }
          }
        }
      `;

      const result = await shopifyGraphQL(env, publishQuery, {
        id: gid,
        input: [{ publicationId: node.id }]
      });

      if (result.publishablePublish?.userErrors?.length > 0) {
        const errMsg = result.publishablePublish.userErrors.map(e => e.message).join(", ");
        console.error('[Publish] Error for', node.name, ':', errMsg);
        errors.push({ channel: node.name, error: errMsg });
      } else {
        console.log('[Publish] Success for', node.name);
        successCount++;
      }
    } catch (err) {
      console.error('[Publish] Exception for', node.name, ':', err.message);
      errors.push({ channel: node.name, error: err.message });
    }
  }

  console.log('[Publish] Published to', successCount, 'of', publications.length, 'channels');

  // If no channels succeeded, try REST API as fallback
  if (successCount === 0) {
    console.log('[Publish] All GraphQL attempts failed, using REST API fallback');
    return await publishProductViaREST(env, numericId);
  }

  return {
    id: gid,
    publishedChannels: successCount,
    totalChannels: publications.length,
    errors: errors.length > 0 ? errors : undefined
  };
}

// Publish product using REST API - publishes to Online Store
async function publishProductViaREST(env, productId) {
  const numericId = productId.includes("/") ? productId.split("/").pop() : productId;

  console.log('[Publish REST] Attempting to publish product:', numericId);
  console.log('[Publish REST] Using domain:', env.SHOPIFY_DOMAIN);

  // First, get the product to ensure it exists
  const getResponse = await fetch(
    `https://${env.SHOPIFY_DOMAIN}/admin/api/2024-01/products/${numericId}.json`,
    {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': env.SHOPIFY_ACCESS_TOKEN
      }
    }
  );

  if (!getResponse.ok) {
    const errorText = await getResponse.text();
    console.error('[Publish REST] Get product error:', errorText);
    throw new Error(`Failed to get product: ${getResponse.status}`);
  }

  const productData = await getResponse.json();
  console.log('[Publish REST] Current product status:', productData.product?.status);

  // Update product with published_at to current time (this publishes it)
  const response = await fetch(
    `https://${env.SHOPIFY_DOMAIN}/admin/api/2024-01/products/${numericId}.json`,
    {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': env.SHOPIFY_ACCESS_TOKEN
      },
      body: JSON.stringify({
        product: {
          id: parseInt(numericId),
          published_at: new Date().toISOString(),
          status: 'active'
        }
      })
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[Publish REST] Update error:', errorText);
    throw new Error(`REST API publish failed: ${response.status}`);
  }

  const result = await response.json();
  console.log('[Publish REST] Updated product:', result.product?.id, 'published_at:', result.product?.published_at);
  return result.product;
}

// Publish metaobject using metaobjectUpsert with capabilities
async function publishMetaobjectToOnlineStore(env, metaobjectId) {
  const gid = metaobjectId.startsWith("gid://") ? metaobjectId : `gid://shopify/Metaobject/${metaobjectId}`;

  console.log('[PublishMetaobject] Starting publish for:', gid);

  // First ensure definition has storefront access
  try {
    const accessResult = await ensureMetaobjectDefinitionAccess(env, "vehicle");
    console.log('[PublishMetaobject] Definition access:', JSON.stringify(accessResult));
  } catch (defErr) {
    console.error('[PublishMetaobject] Definition access error:', defErr.message);
  }

  // For metaobjects with publishable capability, we need to use metaobjectUpdate
  // with the capabilities.publishable.status set to ACTIVE
  const updateQuery = `
    mutation PublishMetaobject($id: ID!) {
      metaobjectUpdate(id: $id, metaobject: {
        capabilities: {
          publishable: {
            status: ACTIVE
          }
        }
      }) {
        metaobject {
          id
          handle
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  try {
    const result = await shopifyGraphQL(env, updateQuery, { id: gid });

    console.log('[PublishMetaobject] Update result:', JSON.stringify(result));

    if (result.metaobjectUpdate?.userErrors?.length > 0) {
      const errors = result.metaobjectUpdate.userErrors;
      console.error('[PublishMetaobject] Errors:', errors);
      return {
        id: gid,
        success: false,
        errors: errors.map(e => e.message)
      };
    }

    console.log('[PublishMetaobject] Successfully set status to ACTIVE');
    return {
      id: gid,
      success: true,
      message: "Metaobject published (status: ACTIVE)"
    };
  } catch (err) {
    console.error('[PublishMetaobject] Exception:', err.message);
    return {
      id: gid,
      success: false,
      error: err.message
    };
  }
}

// Ensure metaobject definition has Storefront API access enabled
async function ensureMetaobjectDefinitionAccess(env, type) {
  // Get the metaobject definition with full details
  const defQuery = `
    query GetMetaobjectDefinition($type: String!) {
      metaobjectDefinitionByType(type: $type) {
        id
        name
        type
        access {
          storefront
          admin
        }
        capabilities {
          publishable {
            enabled
          }
        }
      }
    }
  `;

  const defResult = await shopifyGraphQL(env, defQuery, { type });
  const definition = defResult.metaobjectDefinitionByType;

  if (!definition) {
    console.log('[MetaobjectDef] Definition not found for type:', type);
    throw new Error(`Metaobject definition not found for type: ${type}`);
  }

  console.log('[MetaobjectDef] Definition:', JSON.stringify(definition));

  // Check current storefront access
  const currentAccess = definition.access?.storefront;
  console.log('[MetaobjectDef] Current storefront access:', currentAccess);

  // If storefront access is not PUBLIC_READ, update it
  if (currentAccess !== 'PUBLIC_READ') {
    console.log('[MetaobjectDef] Enabling Storefront API access for:', type);

    const updateQuery = `
      mutation UpdateMetaobjectDefinition($id: ID!, $definition: MetaobjectDefinitionUpdateInput!) {
        metaobjectDefinitionUpdate(id: $id, definition: $definition) {
          metaobjectDefinition {
            id
            access {
              storefront
            }
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

    const updateResult = await shopifyGraphQL(env, updateQuery, {
      id: definition.id,
      definition: {
        access: {
          storefront: "PUBLIC_READ"
        }
      }
    });

    console.log('[MetaobjectDef] Update result:', JSON.stringify(updateResult));

    if (updateResult.metaobjectDefinitionUpdate?.userErrors?.length > 0) {
      const errors = updateResult.metaobjectDefinitionUpdate.userErrors;
      console.error('[MetaobjectDef] Errors:', errors);
      throw new Error(errors.map(e => e.message).join(", "));
    }

    return {
      updated: true,
      previousAccess: currentAccess,
      newAccess: 'PUBLIC_READ'
    };
  }

  return {
    updated: false,
    currentAccess: currentAccess,
    message: 'Storefront access already enabled'
  };
}

async function setInventoryQuantity(env, inventoryItemId, quantity) {
  // Ensure inventoryItemId is a proper GID
  const itemGid = inventoryItemId.startsWith("gid://") ? inventoryItemId : `gid://shopify/InventoryItem/${inventoryItemId}`;

  // Get location and current quantity from the inventory item itself (doesn't require locations scope)
  const inventoryQuery = `
    query GetInventoryItem($id: ID!) {
      inventoryItem(id: $id) {
        id
        tracked
        inventoryLevels(first: 1) {
          edges {
            node {
              id
              location {
                id
                name
              }
              quantities(names: ["available"]) {
                name
                quantity
              }
            }
          }
        }
      }
    }
  `;

  const invResult = await shopifyGraphQL(env, inventoryQuery, { id: itemGid });

  // Check if inventory is tracked
  if (invResult.inventoryItem?.tracked === false) {
    throw new Error('Inventory not tracked for this product. Enable inventory tracking in Shopify first.');
  }

  const inventoryLevel = invResult.inventoryItem?.inventoryLevels?.edges?.[0]?.node;

  if (!inventoryLevel) {
    throw new Error('No inventory level found. The product may not have inventory tracking enabled.');
  }

  const locationId = inventoryLevel.location.id;
  const locationName = inventoryLevel.location.name;
  const currentQty = inventoryLevel.quantities?.[0]?.quantity || 0;

  console.log('[Inventory] Item:', itemGid, 'Location:', locationId, '(' + locationName + ')', 'Current:', currentQty);

  const targetQty = parseInt(quantity);
  const delta = targetQty - currentQty;

  console.log('[Inventory] Target:', targetQty, 'Delta:', delta);

  if (delta === 0) {
    console.log('[Inventory] No change needed');
    return { success: true, message: 'No change needed', quantity: currentQty };
  }

  // Use inventoryAdjustQuantities mutation
  const adjustMutation = `
    mutation AdjustInventory($input: InventoryAdjustQuantitiesInput!) {
      inventoryAdjustQuantities(input: $input) {
        inventoryAdjustmentGroup {
          reason
          changes {
            name
            delta
            quantityAfterChange
          }
        }
        userErrors { field message code }
      }
    }
  `;

  const adjustResult = await shopifyGraphQL(env, adjustMutation, {
    input: {
      name: "available",
      reason: "correction",
      changes: [{
        inventoryItemId: itemGid,
        locationId: locationId,
        delta: delta
      }]
    }
  });

  console.log('[Inventory] Adjust result:', JSON.stringify(adjustResult));

  if (adjustResult.inventoryAdjustQuantities?.userErrors?.length > 0) {
    const errors = adjustResult.inventoryAdjustQuantities.userErrors;
    console.error('[Inventory] Errors:', JSON.stringify(errors));
    throw new Error(errors.map(e => e.message).join(", "));
  }

  const finalQty = adjustResult.inventoryAdjustQuantities?.inventoryAdjustmentGroup?.changes?.[0]?.quantityAfterChange;
  console.log('[Inventory] Final quantity:', finalQty);

  return { success: true, quantity: finalQty, result: adjustResult.inventoryAdjustQuantities?.inventoryAdjustmentGroup };
}

async function updateProduct(env, productId, data) {
  const gid = productId.startsWith("gid://") ? productId : `gid://shopify/Product/${productId}`;

  const query = `
    mutation UpdateProduct($input: ProductInput!) {
      productUpdate(input: $input) {
        product {
          id
          title
          handle
        }
        userErrors { field message }
      }
    }
  `;

  const input = { id: gid };

  if (data.title !== undefined) input.title = data.title;
  if (data.description !== undefined) input.descriptionHtml = data.description;
  if (data.vendor !== undefined) input.vendor = data.vendor;
  if (data.productType !== undefined) input.productType = data.productType;
  if (data.tags !== undefined) input.tags = data.tags;
  if (data.status !== undefined) input.status = data.status;

  // Add B2B price metafield if provided
  if (data.b2bPrice !== undefined) {
    input.metafields = input.metafields || [];
    if (data.b2bPrice) {
      input.metafields.push({
        namespace: "custom",
        key: "b2b_price",
        type: "number_decimal",
        value: formatPrice(data.b2bPrice)
      });
    }
  }

  // Add or clear Discount price metafield
  // Track if we need to delete the metafield separately (after product update)
  let shouldDeleteDiscountMetafield = false;

  if (data.discountPrice !== undefined) {
    input.metafields = input.metafields || [];
    if (data.discountPrice && data.discountPrice !== '' && data.discountPrice !== null) {
      input.metafields.push({
        namespace: "custom",
        key: "discount_price",
        type: "number_decimal",
        value: formatPrice(data.discountPrice)
      });
    } else {
      // Mark for deletion after product update
      shouldDeleteDiscountMetafield = true;
      console.log(`[Pricing] Will delete discount_price metafield for product ${gid}`);
    }
  }

  const result = await shopifyGraphQL(env, query, { input });

  if (result.productUpdate.userErrors?.length > 0) {
    throw new Error(result.productUpdate.userErrors.map(e => e.message).join(", "));
  }

  // Handle pricing logic for standard customers
  // When discount_price is set: variant.price = discount_price, variant.compare_at_price = original
  // This ensures checkout charges the correct (discounted) price
  if (data.variantId) {
    const discountPrice = data.discountPrice ? parseFloat(data.discountPrice) : null;
    const originalPrice = data.price ? parseFloat(data.price) : null;
    const compareAtPrice = data.compareAtPrice ? parseFloat(data.compareAtPrice) : null;

    if (discountPrice && discountPrice > 0) {
      // Discount price is set - use it as the actual price
      // Original price (or compare_at if higher) becomes compare_at
      const newCompareAt = compareAtPrice && compareAtPrice > discountPrice
        ? compareAtPrice
        : (originalPrice && originalPrice > discountPrice ? originalPrice : null);

      await updateVariantPrice(env, gid, data.variantId, discountPrice, newCompareAt);
      console.log(`[Pricing] Set variant price to discount: $${discountPrice}, compare_at: $${newCompareAt}`);
    } else if (originalPrice !== null) {
      // No discount price - use normal pricing
      await updateVariantPrice(env, gid, data.variantId, originalPrice, compareAtPrice);
    }
  }

  // Delete discount_price metafield if flagged for deletion
  let metafieldDeleted = false;
  let metafieldDebug = {};

  if (shouldDeleteDiscountMetafield) {
    metafieldDebug.attempted = true;
    try {
      // First check if metafield exists
      const existingMetafield = await getProductMetafield(env, gid, "custom", "discount_price");
      metafieldDebug.found = existingMetafield;

      if (existingMetafield && existingMetafield.id) {
        // Delete using ownerId (product GID), namespace, and key
        metafieldDebug.deletingFor = { ownerId: gid, namespace: "custom", key: "discount_price" };
        const deleteResult = await deleteMetafield(env, gid, "custom", "discount_price");
        metafieldDebug.deleteResult = deleteResult;
        metafieldDeleted = true;
      } else {
        metafieldDebug.notFound = true;
      }
    } catch (e) {
      metafieldDebug.error = e.message;
      // Don't throw - we still want to return success for the product update
    }
  }

  // Publish to Online Store if status is being set to ACTIVE
  if (data.status === "ACTIVE") {
    try {
      await publishProductToOnlineStore(env, gid);
      console.log('[UpdateProduct] Published to Online Store');
    } catch (pubErr) {
      console.error('[UpdateProduct] Failed to publish to Online Store:', pubErr.message);
    }
  }

  return {
    success: true,
    data: result.productUpdate.product,
    metafieldDeleted: shouldDeleteDiscountMetafield ? metafieldDeleted : undefined,
    metafieldDebug: shouldDeleteDiscountMetafield ? metafieldDebug : undefined
  };
}

async function updateVariantPrice(env, productId, variantId, price, compareAtPrice) {
  const productGid = productId.startsWith("gid://") ? productId : `gid://shopify/Product/${productId}`;
  const variantGid = variantId.startsWith("gid://") ? variantId : `gid://shopify/ProductVariant/${variantId}`;

  const query = `
    mutation UpdateVariants($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
      productVariantsBulkUpdate(productId: $productId, variants: $variants) {
        productVariants { id price compareAtPrice }
        userErrors { field message }
      }
    }
  `;

  const variant = { id: variantGid, price: formatPrice(price) };
  if (compareAtPrice !== undefined) variant.compareAtPrice = compareAtPrice ? formatPrice(compareAtPrice) : null;

  const result = await shopifyGraphQL(env, query, {
    productId: productGid,
    variants: [variant]
  });

  if (result.productVariantsBulkUpdate?.userErrors?.length > 0) {
    throw new Error(result.productVariantsBulkUpdate.userErrors.map(e => e.message).join(", "));
  }

  return result.productVariantsBulkUpdate?.productVariants?.[0];
}

async function deleteProduct(env, productId) {
  const gid = productId.startsWith("gid://") ? productId : `gid://shopify/Product/${productId}`;

  const query = `
    mutation DeleteProduct($input: ProductDeleteInput!) {
      productDelete(input: $input) {
        deletedProductId
        userErrors { field message }
      }
    }
  `;

  const result = await shopifyGraphQL(env, query, { input: { id: gid } });

  if (result.productDelete.userErrors?.length > 0) {
    throw new Error(result.productDelete.userErrors.map(e => e.message).join(", "));
  }

  return { success: true, message: "Product deleted" };
}

// ============================================
// FITMENT OPERATIONS
// ============================================

async function updateProductFitment(env, data) {
  const { product_id, vehicle_id, vehicle_ids } = data;

  if (!product_id) throw new Error("product_id is required");

  const vehicleIdsToAdd = vehicle_ids || (vehicle_id ? [vehicle_id] : []);
  if (vehicleIdsToAdd.length === 0) throw new Error("vehicle_id or vehicle_ids required");

  const productGid = product_id.startsWith("gid://") ? product_id : `gid://shopify/Product/${product_id}`;

  // Get existing fitments
  const existingQuery = `
    query GetExistingFitments($id: ID!) {
      product(id: $id) {
        id
        metafield(namespace: "custom", key: "fits_vehicles") { value }
      }
    }
  `;

  const existingResult = await shopifyGraphQL(env, existingQuery, { id: productGid });
  if (!existingResult.product) throw new Error("Product not found");

  let existingFitments = [];
  try {
    existingFitments = JSON.parse(existingResult.product.metafield?.value || "[]");
  } catch (e) { }

  // Add new vehicles (avoid duplicates)
  const newFitments = [...existingFitments];
  for (const vid of vehicleIdsToAdd) {
    const vehicleGid = vid.startsWith("gid://") ? vid : `gid://shopify/Metaobject/${vid}`;
    if (!newFitments.includes(vehicleGid)) {
      newFitments.push(vehicleGid);
    }
  }

  // Update metafield
  const updateQuery = `
    mutation UpdateFitment($input: ProductInput!) {
      productUpdate(input: $input) {
        product { id }
        userErrors { field message }
      }
    }
  `;

  const result = await shopifyGraphQL(env, updateQuery, {
    input: {
      id: productGid,
      metafields: [{
        namespace: "custom",
        key: "fits_vehicles",
        type: "list.metaobject_reference",
        value: JSON.stringify(newFitments)
      }]
    }
  });

  if (result.productUpdate.userErrors?.length > 0) {
    throw new Error(result.productUpdate.userErrors.map(e => e.message).join(", "));
  }

  return { success: true, message: "Fitments updated", totalFitments: newFitments.length };
}

async function removeProductFitment(env, productId, vehicleId) {
  const productGid = productId.startsWith("gid://") ? productId : `gid://shopify/Product/${productId}`;
  const vehicleGid = vehicleId.startsWith("gid://") ? vehicleId : `gid://shopify/Metaobject/${vehicleId}`;

  // Get existing fitments
  const existingQuery = `
    query GetExistingFitments($id: ID!) {
      product(id: $id) {
        metafield(namespace: "custom", key: "fits_vehicles") { value }
      }
    }
  `;

  const existingResult = await shopifyGraphQL(env, existingQuery, { id: productGid });
  let fitments = [];
  try {
    fitments = JSON.parse(existingResult.product?.metafield?.value || "[]");
  } catch (e) { }

  // Remove vehicle
  fitments = fitments.filter(f => f !== vehicleGid);

  // Update
  const updateQuery = `
    mutation UpdateFitment($input: ProductInput!) {
      productUpdate(input: $input) {
        product { id }
        userErrors { field message }
      }
    }
  `;

  await shopifyGraphQL(env, updateQuery, {
    input: {
      id: productGid,
      metafields: [{
        namespace: "custom",
        key: "fits_vehicles",
        type: "list.metaobject_reference",
        value: JSON.stringify(fitments)
      }]
    }
  });

  return { success: true, message: "Fitment removed" };
}

// ============================================
// MEDIA OPERATIONS
// ============================================

// Create staged upload URL for direct file upload
async function createStagedUpload(env, data) {
  const { filename, mimeType, fileSize } = data;

  // Determine resource type based on mime type
  let resource = "IMAGE";
  if (mimeType.startsWith("video/")) resource = "VIDEO";
  else if (mimeType.startsWith("model/")) resource = "MODEL_3D";

  const query = `
    mutation CreateStagedUpload($input: [StagedUploadInput!]!) {
      stagedUploadsCreate(input: $input) {
        stagedTargets {
          url
          resourceUrl
          parameters {
            name
            value
          }
        }
        userErrors { field message }
      }
    }
  `;

  const input = [{
    filename,
    mimeType,
    fileSize: String(fileSize),
    resource,
    httpMethod: "POST"
  }];

  const result = await shopifyGraphQL(env, query, { input });

  if (result.stagedUploadsCreate.userErrors?.length > 0) {
    throw new Error(result.stagedUploadsCreate.userErrors.map(e => e.message).join(", "));
  }

  const target = result.stagedUploadsCreate.stagedTargets[0];
  return {
    success: true,
    data: {
      uploadUrl: target.url,
      resourceUrl: target.resourceUrl,
      parameters: target.parameters
    }
  };
}

// Add media from URL or staged upload resourceUrl
async function addProductMedia(env, productId, data) {
  const gid = productId.startsWith("gid://") ? productId : `gid://shopify/Product/${productId}`;

  const query = `
    mutation AddMedia($productId: ID!, $media: [CreateMediaInput!]!) {
      productCreateMedia(productId: $productId, media: $media) {
        media {
          ... on MediaImage { id }
          ... on Video { id }
        }
        mediaUserErrors { field message }
      }
    }
  `;

  // Support both urls array and single resourceUrl from staged upload
  let mediaInputs = [];

  if (data.resourceUrl) {
    // From staged upload
    mediaInputs.push({
      originalSource: data.resourceUrl,
      mediaContentType: data.mediaContentType || "IMAGE",
      alt: data.alt || ""
    });
  } else if (data.urls) {
    // From URL array
    mediaInputs = data.urls.map(url => ({
      originalSource: url,
      mediaContentType: url.match(/\.(mp4|mov|webm)$/i) ? "VIDEO" : "IMAGE",
      alt: data.alt || ""
    }));
  } else {
    throw new Error("Either resourceUrl or urls array required");
  }

  const result = await shopifyGraphQL(env, query, { productId: gid, media: mediaInputs });

  if (result.productCreateMedia.mediaUserErrors?.length > 0) {
    throw new Error(result.productCreateMedia.mediaUserErrors.map(e => e.message).join(", "));
  }

  return { success: true, data: result.productCreateMedia.media };
}

async function deleteProductMedia(env, productId, mediaId) {
  const productGid = productId.startsWith("gid://") ? productId : `gid://shopify/Product/${productId}`;

  // Handle various GID formats - media IDs should be passed as-is if they're already GIDs
  let mediaGid = mediaId;
  if (!mediaId.startsWith("gid://")) {
    mediaGid = `gid://shopify/MediaImage/${mediaId}`;
  }

  const query = `
    mutation DeleteMedia($productId: ID!, $mediaIds: [ID!]!) {
      productDeleteMedia(productId: $productId, mediaIds: $mediaIds) {
        deletedMediaIds
        mediaUserErrors { field message code }
      }
    }
  `;

  console.log("Deleting media:", { productGid, mediaGid });

  const result = await shopifyGraphQL(env, query, { productId: productGid, mediaIds: [mediaGid] });

  if (result.productDeleteMedia.mediaUserErrors?.length > 0) {
    const errors = result.productDeleteMedia.mediaUserErrors;
    console.error("Media delete errors:", errors);
    throw new Error(errors.map(e => e.message).join(", "));
  }

  if (!result.productDeleteMedia.deletedMediaIds || result.productDeleteMedia.deletedMediaIds.length === 0) {
    throw new Error("No media was deleted - ID may be invalid");
  }

  return { success: true, message: "Media deleted", deletedIds: result.productDeleteMedia.deletedMediaIds };
}

// ============================================
// INVENTORY OPERATIONS
// ============================================

async function updateInventory(env, productId, data) {
  // First get the inventory item ID
  const gid = productId.startsWith("gid://") ? productId : `gid://shopify/Product/${productId}`;

  const getQuery = `
    query GetInventoryItem($id: ID!) {
      product(id: $id) {
        variants(first: 1) {
          edges {
            node {
              inventoryItem {
                id
              }
            }
          }
        }
      }
    }
  `;

  const getResult = await shopifyGraphQL(env, getQuery, { id: gid });
  const inventoryItemId = getResult.product?.variants?.edges[0]?.node?.inventoryItem?.id;

  if (!inventoryItemId) {
    throw new Error("Could not find inventory item");
  }

  const newQty = parseInt(data.quantity, 10);
  console.log('[UpdateInventory] Setting inventory to:', newQty, 'for product:', productId);

  // Use the same setInventoryQuantity function which handles activation
  const result = await setInventoryQuantity(env, inventoryItemId, newQty);

  return {
    success: true,
    message: "Inventory updated",
    quantity: newQty,
    result: result
  };
}

async function enableInventoryTracking(env, productId) {
  const gid = productId.startsWith("gid://") ? productId : `gid://shopify/Product/${productId}`;

  // Get the variant ID
  const getQuery = `
    query GetVariant($id: ID!) {
      product(id: $id) {
        variants(first: 1) {
          edges {
            node {
              id
              inventoryItem {
                id
                tracked
              }
            }
          }
        }
      }
    }
  `;

  const getResult = await shopifyGraphQL(env, getQuery, { id: gid });
  const variant = getResult.product?.variants?.edges[0]?.node;

  if (!variant) {
    throw new Error("Could not find product variant");
  }

  if (variant.inventoryItem?.tracked === true) {
    return { success: true, message: "Inventory tracking already enabled" };
  }

  const inventoryItemId = variant.inventoryItem?.id;
  if (!inventoryItemId) {
    throw new Error("Could not find inventory item ID");
  }

  // Enable inventory tracking via inventoryItemUpdate
  const updateQuery = `
    mutation EnableTracking($id: ID!, $input: InventoryItemInput!) {
      inventoryItemUpdate(id: $id, input: $input) {
        inventoryItem {
          id
          tracked
        }
        userErrors { field message }
      }
    }
  `;

  const result = await shopifyGraphQL(env, updateQuery, {
    id: inventoryItemId,
    input: {
      tracked: true
    }
  });

  if (result.inventoryItemUpdate?.userErrors?.length > 0) {
    throw new Error(result.inventoryItemUpdate.userErrors.map(e => e.message).join(", "));
  }

  console.log('[EnableTracking] Enabled for product:', productId);
  return { success: true, message: "Inventory tracking enabled" };
}

// ============================================
// B2B CHECKOUT - Draft Order Creation
// ============================================

/**
 * Creates a draft order with B2B pricing for a customer
 * This allows B2B customers to checkout at their wholesale prices
 * 
 * @param {object} env - Environment variables
 * @param {object} data - { customerId, lineItems: [{ variantId, quantity }], note? }
 */
async function createB2BCheckout(env, data) {
  const { customerId, lineItems, note, shippingAddress, billingAddress } = data;

  if (!customerId || !lineItems || lineItems.length === 0) {
    throw new Error("customerId and lineItems are required");
  }

  // First, get customer info to verify B2B tag
  const customerGid = customerId.startsWith("gid://") ? customerId : `gid://shopify/Customer/${customerId}`;

  const customerQuery = `
    query GetCustomer($id: ID!) {
      customer(id: $id) {
        id
        email
        firstName
        lastName
        tags
        defaultAddress {
          firstName
          lastName
          company
          address1
          address2
          city
          provinceCode
          countryCodeV2
          zip
          phone
        }
      }
    }
  `;

  const customerResult = await shopifyGraphQL(env, customerQuery, { id: customerGid });

  if (!customerResult.customer) {
    throw new Error("Customer not found");
  }

  const customer = customerResult.customer;
  const isB2B = customer.tags.map(t => t.toLowerCase()).includes('b2b');

  if (!isB2B) {
    throw new Error("Customer is not tagged as B2B. Only B2B customers can use wholesale checkout.");
  }

  // Get product info with B2B prices for each line item
  const lineItemsWithPrices = [];
  const priceDebugInfo = [];

  for (const item of lineItems) {
    const variantGid = item.variantId.startsWith("gid://")
      ? item.variantId
      : `gid://shopify/ProductVariant/${item.variantId}`;

    // Extract addon price from line item properties if present
    const addonPrice = item.properties?._addon_price ? parseFloat(item.properties._addon_price) : 0;

    const variantQuery = `
      query GetVariant($id: ID!) {
        productVariant(id: $id) {
          id
          title
          price
          variantB2bPrice: metafield(namespace: "custom", key: "b2b_price") {
            value
          }
          variantDiscountPrice: metafield(namespace: "custom", key: "discount_price") {
            value
          }
          product {
            id
            title
            b2bPrice: metafield(namespace: "custom", key: "b2b_price") {
              value
            }
            discountPrice: metafield(namespace: "custom", key: "discount_price") {
              value
            }
          }
        }
      }
    `;

    const variantResult = await shopifyGraphQL(env, variantQuery, { id: variantGid });

    if (!variantResult.productVariant) {
      throw new Error(`Variant ${item.variantId} not found`);
    }

    const variant = variantResult.productVariant;
    const variantPrice = parseFloat(variant.price);

    // Check variant-level prices first, then fall back to product-level
    const variantB2bPriceRaw = variant.variantB2bPrice?.value;
    const productB2bPriceRaw = variant.product.b2bPrice?.value;
    const variantDiscountPriceRaw = variant.variantDiscountPrice?.value;
    const productDiscountPriceRaw = variant.product.discountPrice?.value;

    const b2bPriceRaw = variantB2bPriceRaw || productB2bPriceRaw;
    const discountPriceRaw = variantDiscountPriceRaw || productDiscountPriceRaw;

    const b2bPrice = b2bPriceRaw ? parseFloat(b2bPriceRaw) : null;
    const discountPrice = discountPriceRaw ? parseFloat(discountPriceRaw) : null;

    // Debug info
    const priceDebug = {
      variantPrice,
      b2bPriceRaw,
      b2bPrice,
      discountPriceRaw,
      discountPrice,
      productTitle: variant.product.title
    };
    console.log('[B2B Checkout] Price data for variant:', JSON.stringify(priceDebug));

    // B2B pricing logic:
    // 1. If B2B price exists, use it (it's always lower than retail)
    // 2. If discount price also exists AND is lower than B2B price, use discount instead
    // 3. If no B2B price but discount exists, use discount
    // 4. Otherwise use variant price (retail)

    let effectivePrice = variantPrice;
    let priceReason = "Retail";

    if (b2bPrice !== null && b2bPrice > 0) {
      // B2B price exists - start with it
      effectivePrice = b2bPrice;
      priceReason = "Wholesale";

      // Check if discount price is even lower than B2B
      if (discountPrice !== null && discountPrice > 0 && discountPrice < b2bPrice) {
        effectivePrice = discountPrice;
        priceReason = "Sale (better than wholesale)";
      }
    } else if (discountPrice !== null && discountPrice > 0) {
      // No B2B price, but discount exists
      effectivePrice = discountPrice;
      priceReason = "Sale";
    }

    // Add addon price to effective price (addons increase the price)
    const finalPrice = effectivePrice + addonPrice;

    console.log('[B2B Checkout] Effective price:', effectivePrice, 'Addon:', addonPrice, 'Final:', finalPrice, 'Reason:', priceReason);

    // Calculate the discount amount (difference between variant price and final price)
    // Note: If addon price is added, discount will be less (or negative if addon > discount)
    const discountAmount = variantPrice - finalPrice;

    // Build custom attributes including addon info
    const customAttributes = [
      { key: "_pricing_type", value: priceReason },
      { key: "_variant_price", value: formatPrice(variantPrice) },
      { key: "_b2b_price", value: b2bPrice ? formatPrice(b2bPrice) : "none" },
      { key: "_discount_price", value: discountPrice ? formatPrice(discountPrice) : "none" }
    ];

    // Add addon properties from the original item
    if (item.properties) {
      Object.entries(item.properties).forEach(([key, value]) => {
        if (!key.startsWith('_')) {
          // Add visible addon selections (e.g., "Valve: With Valve (+$50)")
          customAttributes.push({ key, value: String(value) });
        }
      });
      if (addonPrice > 0) {
        customAttributes.push({ key: "_addon_price", value: formatPrice(addonPrice) });
      }
    }

    const lineItem = {
      variantId: variantGid,
      quantity: item.quantity,
      customAttributes
    };

    // Apply discount if final price is lower than variant price
    if (discountAmount > 0.01) {
      lineItem.appliedDiscount = {
        title: priceReason,
        description: `${priceReason} pricing applied`,
        valueType: "FIXED_AMOUNT",
        value: Math.round(discountAmount * 100) / 100
      };
    } else if (discountAmount < -0.01) {
      // Addon price exceeds any discount - we need to handle this differently
      // Draft orders don't support price increases, so we'll add a custom line item for the addon
      // For now, just note it in attributes - the addon will be shown but not charged extra
      // TODO: Add a separate custom line item for addon charges if needed
      console.log('[B2B Checkout] Warning: Addon price exceeds discount, addon charge may not be applied');
    }

    lineItemsWithPrices.push(lineItem);

    // Store debug info
    priceDebugInfo.push({
      ...priceDebug,
      addonPrice,
      discountAmount,
      effectivePrice,
      finalPrice,
      priceReason
    });
  }

  // Create the draft order
  const draftOrderQuery = `
    mutation CreateDraftOrder($input: DraftOrderInput!) {
      draftOrderCreate(input: $input) {
        draftOrder {
          id
          name
          invoiceUrl
          totalPrice
          subtotalPrice
          totalTax
          lineItems(first: 50) {
            edges {
              node {
                id
                title
                quantity
                originalUnitPrice
              }
            }
          }
        }
        userErrors { field message }
      }
    }
  `;

  const draftOrderInput = {
    customerId: customerGid,
    lineItems: lineItemsWithPrices,
    note: note || `B2B Order - Wholesale pricing applied`,
    tags: ["b2b-order", "wholesale"],
    visibleToCustomer: true
  };

  // Add addresses if provided
  if (shippingAddress) {
    draftOrderInput.shippingAddress = shippingAddress;
  } else if (customer.defaultAddress) {
    // Format the default address for MailingAddressInput
    const addr = customer.defaultAddress;
    draftOrderInput.shippingAddress = {
      firstName: addr.firstName || customer.firstName,
      lastName: addr.lastName || customer.lastName,
      company: addr.company || null,
      address1: addr.address1,
      address2: addr.address2 || null,
      city: addr.city,
      provinceCode: addr.provinceCode,
      countryCode: addr.countryCodeV2,
      zip: addr.zip,
      phone: addr.phone || null
    };
  }

  if (billingAddress) {
    draftOrderInput.billingAddress = billingAddress;
  } else if (customer.defaultAddress) {
    // Use default address for billing too if not provided
    const addr = customer.defaultAddress;
    draftOrderInput.billingAddress = {
      firstName: addr.firstName || customer.firstName,
      lastName: addr.lastName || customer.lastName,
      company: addr.company || null,
      address1: addr.address1,
      address2: addr.address2 || null,
      city: addr.city,
      provinceCode: addr.provinceCode,
      countryCode: addr.countryCodeV2,
      zip: addr.zip,
      phone: addr.phone || null
    };
  }

  const result = await shopifyGraphQL(env, draftOrderQuery, { input: draftOrderInput });

  if (result.draftOrderCreate.userErrors?.length > 0) {
    throw new Error(result.draftOrderCreate.userErrors.map(e => e.message).join(", "));
  }

  const draftOrder = result.draftOrderCreate.draftOrder;

  return {
    success: true,
    data: {
      id: draftOrder.id,
      name: draftOrder.name,
      checkoutUrl: draftOrder.invoiceUrl, // This is the URL customer can use to checkout
      subtotal: draftOrder.subtotalPrice,
      tax: draftOrder.totalTax,
      total: draftOrder.totalPrice,
      lineItems: draftOrder.lineItems.edges.map(e => ({
        title: e.node.title,
        quantity: e.node.quantity,
        price: e.node.originalUnitPrice
      })),
      priceDebug: priceDebugInfo // Debug info to see what prices were found
    },
    message: "B2B checkout created. Customer can complete payment at the checkout URL."
  };
}

/**
 * Get cart with B2B pricing applied for display/preview
 */
async function getB2BCartPreview(env, customerId, cartItems) {
  // Verify customer is B2B
  const customerGid = customerId.startsWith("gid://") ? customerId : `gid://shopify/Customer/${customerId}`;

  const customerQuery = `
    query GetCustomer($id: ID!) {
      customer(id: $id) {
        id
        tags
      }
    }
  `;

  const customerResult = await shopifyGraphQL(env, customerQuery, { id: customerGid });
  const isB2B = customerResult.customer?.tags?.map(t => t.toLowerCase()).includes('b2b') || false;

  const previewItems = [];
  let subtotal = 0;
  let retailSubtotal = 0;

  for (const item of cartItems) {
    const variantGid = item.variantId.startsWith("gid://")
      ? item.variantId
      : `gid://shopify/ProductVariant/${item.variantId}`;

    const variantQuery = `
      query GetVariant($id: ID!) {
        productVariant(id: $id) {
          id
          title
          price
          variantB2bPrice: metafield(namespace: "custom", key: "b2b_price") { value }
          variantDiscountPrice: metafield(namespace: "custom", key: "discount_price") { value }
          product {
            title
            b2bPrice: metafield(namespace: "custom", key: "b2b_price") { value }
            discountPrice: metafield(namespace: "custom", key: "discount_price") { value }
          }
        }
      }
    `;

    const variantResult = await shopifyGraphQL(env, variantQuery, { id: variantGid });

    if (!variantResult.productVariant) continue;

    const variant = variantResult.productVariant;
    const originalPrice = parseFloat(variant.price);
    // Check variant-level prices first, then fall back to product-level
    const variantB2bPrice = variant.variantB2bPrice?.value ? parseFloat(variant.variantB2bPrice.value) : null;
    const productB2bPrice = variant.product.b2bPrice?.value ? parseFloat(variant.product.b2bPrice.value) : null;
    const variantDiscountPrice = variant.variantDiscountPrice?.value ? parseFloat(variant.variantDiscountPrice.value) : null;
    const productDiscountPrice = variant.product.discountPrice?.value ? parseFloat(variant.product.discountPrice.value) : null;

    const b2bPrice = variantB2bPrice || productB2bPrice;
    const discountPrice = variantDiscountPrice || productDiscountPrice;

    let effectivePrice = originalPrice;
    let priceType = "retail";

    if (isB2B) {
      if (b2bPrice && discountPrice) {
        effectivePrice = b2bPrice <= discountPrice ? b2bPrice : discountPrice;
        priceType = b2bPrice <= discountPrice ? "wholesale" : "sale";
      } else if (b2bPrice) {
        effectivePrice = b2bPrice;
        priceType = "wholesale";
      } else if (discountPrice) {
        effectivePrice = discountPrice;
        priceType = "sale";
      }
    } else {
      if (discountPrice) {
        effectivePrice = discountPrice;
        priceType = "sale";
      }
    }

    const lineTotal = effectivePrice * item.quantity;
    const retailLineTotal = originalPrice * item.quantity;

    subtotal += lineTotal;
    retailSubtotal += retailLineTotal;

    previewItems.push({
      variantId: item.variantId,
      productTitle: variant.product.title,
      variantTitle: variant.title,
      quantity: item.quantity,
      retailPrice: originalPrice.toFixed(2),
      effectivePrice: effectivePrice.toFixed(2),
      priceType,
      lineTotal: lineTotal.toFixed(2),
      savings: (retailLineTotal - lineTotal).toFixed(2)
    });
  }

  return {
    success: true,
    data: {
      isB2B,
      items: previewItems,
      subtotal: subtotal.toFixed(2),
      retailSubtotal: retailSubtotal.toFixed(2),
      totalSavings: (retailSubtotal - subtotal).toFixed(2)
    }
  };
}

// ============================================
// UNIVERSAL CHECKOUT WITH ADDON PRICING
// ============================================

/**
 * Creates a draft order checkout that properly handles addon pricing
 * Works for both regular customers and B2B customers
 * 
 * @param {object} env - Environment variables
 * @param {object} data - { customerId?, email?, lineItems: [{ variantId, quantity, properties }] }
 */
async function createCheckoutWithAddons(env, data) {
  const { customerId, email, lineItems, note } = data;

  if (!lineItems || lineItems.length === 0) {
    throw new Error("lineItems are required");
  }

  // Check if any line items have addon pricing
  const hasAddons = lineItems.some(item => item.properties?._addon_price);

  // Get customer info if customerId provided
  let customer = null;
  let isB2B = false;

  if (customerId) {
    const customerGid = customerId.startsWith("gid://") ? customerId : `gid://shopify/Customer/${customerId}`;

    const customerQuery = `
      query GetCustomer($id: ID!) {
        customer(id: $id) {
          id
          email
          firstName
          lastName
          tags
          defaultAddress {
            firstName
            lastName
            company
            address1
            address2
            city
            provinceCode
            countryCodeV2
            zip
            phone
          }
        }
      }
    `;

    const customerResult = await shopifyGraphQL(env, customerQuery, { id: customerGid });
    customer = customerResult.customer;
    isB2B = customer?.tags?.map(t => t.toLowerCase()).includes('b2b') || false;
  }

  // Build line items with proper pricing
  const lineItemsWithPrices = [];

  for (const item of lineItems) {
    const variantGid = item.variantId.startsWith("gid://")
      ? item.variantId
      : `gid://shopify/ProductVariant/${item.variantId}`;

    // Get addon price from properties
    const addonPrice = item.properties?._addon_price ? parseFloat(item.properties._addon_price) : 0;

    // Get variant and product pricing info
    const variantQuery = `
      query GetVariant($id: ID!) {
        productVariant(id: $id) {
          id
          title
          price
          variantB2bPrice: metafield(namespace: "custom", key: "b2b_price") {
            value
          }
          variantDiscountPrice: metafield(namespace: "custom", key: "discount_price") {
            value
          }
          product {
            id
            title
            b2bPrice: metafield(namespace: "custom", key: "b2b_price") {
              value
            }
            discountPrice: metafield(namespace: "custom", key: "discount_price") {
              value
            }
          }
        }
      }
    `;

    const variantResult = await shopifyGraphQL(env, variantQuery, { id: variantGid });

    if (!variantResult.productVariant) {
      throw new Error(`Variant ${item.variantId} not found`);
    }

    const variant = variantResult.productVariant;
    const variantPrice = parseFloat(variant.price);

    // Get B2B and discount prices - check variant-level first, then product-level
    const variantB2bPriceRaw = variant.variantB2bPrice?.value;
    const productB2bPriceRaw = variant.product.b2bPrice?.value;
    const variantDiscountPriceRaw = variant.variantDiscountPrice?.value;
    const productDiscountPriceRaw = variant.product.discountPrice?.value;

    const b2bPriceRaw = variantB2bPriceRaw || productB2bPriceRaw;
    const discountPriceRaw = variantDiscountPriceRaw || productDiscountPriceRaw;

    const b2bPrice = b2bPriceRaw ? parseFloat(b2bPriceRaw) : null;
    const discountPrice = discountPriceRaw ? parseFloat(discountPriceRaw) : null;

    // Calculate effective base price
    let effectivePrice = variantPrice;
    let priceReason = "Retail";

    if (isB2B && b2bPrice !== null && b2bPrice > 0) {
      effectivePrice = b2bPrice;
      priceReason = "Wholesale";

      // Check if discount is even better
      if (discountPrice !== null && discountPrice > 0 && discountPrice < b2bPrice) {
        effectivePrice = discountPrice;
        priceReason = "Sale (better than wholesale)";
      }
    } else if (discountPrice !== null && discountPrice > 0) {
      effectivePrice = discountPrice;
      priceReason = "Sale";
    }

    // Add addon price to get final price
    const finalPrice = effectivePrice + addonPrice;

    // Calculate discount from variant price to final price
    const discountAmount = variantPrice - finalPrice;

    console.log(`[Checkout] Variant: ${variant.title}, Base: ${variantPrice}, Effective: ${effectivePrice}, Addon: ${addonPrice}, Final: ${finalPrice}, Discount: ${discountAmount}`);

    // Build custom attributes
    const customAttributes = [
      { key: "_pricing_type", value: priceReason }
    ];

    // Add addon properties (visible ones, not internal)
    if (item.properties) {
      Object.entries(item.properties).forEach(([key, value]) => {
        if (!key.startsWith('_')) {
          customAttributes.push({ key, value: String(value) });
        }
      });
      if (addonPrice > 0) {
        customAttributes.push({ key: "_addon_price", value: addonPrice.toFixed(2) });
      }
    }

    const lineItem = {
      variantId: variantGid,
      quantity: item.quantity,
      customAttributes
    };

    // Calculate the base discount (without addon)
    const baseDiscount = variantPrice - effectivePrice;

    // Apply base discount if there is one
    if (baseDiscount > 0.01) {
      lineItem.appliedDiscount = {
        title: priceReason,
        description: `${priceReason} pricing applied`,
        valueType: "FIXED_AMOUNT",
        value: Math.round(baseDiscount * 100) / 100
      };
    }

    lineItemsWithPrices.push(lineItem);

    // If there's an addon price, add it as a separate custom line item
    if (addonPrice > 0) {
      // Get the addon name from properties
      let addonName = "Add-on Option";
      if (item.properties) {
        const addonProps = Object.entries(item.properties).filter(([k, v]) => !k.startsWith('_') && v);
        if (addonProps.length > 0) {
          addonName = addonProps.map(([k, v]) => `${k}: ${v}`).join(', ');
        }
      }

      lineItemsWithPrices.push({
        title: addonName,
        quantity: item.quantity,
        originalUnitPrice: addonPrice.toFixed(2),
        customAttributes: [
          { key: "_type", value: "addon" },
          { key: "_parent_variant", value: variantGid }
        ]
      });
    }
  }

  // Create draft order
  const draftOrderQuery = `
    mutation CreateDraftOrder($input: DraftOrderInput!) {
      draftOrderCreate(input: $input) {
        draftOrder {
          id
          name
          invoiceUrl
          subtotalPrice
          totalTax
          totalPrice
          lineItems(first: 50) {
            edges {
              node {
                title
                quantity
                originalUnitPrice
              }
            }
          }
        }
        userErrors { field message }
      }
    }
  `;

  const draftOrderInput = {
    lineItems: lineItemsWithPrices,
    note: note || (hasAddons ? "Order with add-on options" : "Custom checkout"),
    tags: isB2B ? ["b2b-order", "wholesale"] : ["custom-checkout"],
    visibleToCustomer: true
  };

  // Add customer if available
  if (customer) {
    draftOrderInput.customerId = customer.id;
    if (customer.defaultAddress) {
      // Format the default address for MailingAddressInput
      const addr = customer.defaultAddress;
      draftOrderInput.shippingAddress = {
        firstName: addr.firstName || customer.firstName,
        lastName: addr.lastName || customer.lastName,
        company: addr.company || null,
        address1: addr.address1,
        address2: addr.address2 || null,
        city: addr.city,
        provinceCode: addr.provinceCode,
        countryCode: addr.countryCodeV2,
        zip: addr.zip,
        phone: addr.phone || null
      };
      // Use same address for billing
      draftOrderInput.billingAddress = {
        firstName: addr.firstName || customer.firstName,
        lastName: addr.lastName || customer.lastName,
        company: addr.company || null,
        address1: addr.address1,
        address2: addr.address2 || null,
        city: addr.city,
        provinceCode: addr.provinceCode,
        countryCode: addr.countryCodeV2,
        zip: addr.zip,
        phone: addr.phone || null
      };
    }
  } else if (email) {
    draftOrderInput.email = email;
  }

  const result = await shopifyGraphQL(env, draftOrderQuery, { input: draftOrderInput });

  if (result.draftOrderCreate.userErrors?.length > 0) {
    throw new Error(result.draftOrderCreate.userErrors.map(e => e.message).join(", "));
  }

  const draftOrder = result.draftOrderCreate.draftOrder;

  return {
    success: true,
    data: {
      id: draftOrder.id,
      name: draftOrder.name,
      checkoutUrl: draftOrder.invoiceUrl,
      subtotal: draftOrder.subtotalPrice,
      tax: draftOrder.totalTax,
      total: draftOrder.totalPrice,
      lineItems: draftOrder.lineItems.edges.map(e => ({
        title: e.node.title,
        quantity: e.node.quantity,
        price: e.node.originalUnitPrice
      }))
    },
    message: "Checkout created. Redirecting to payment..."
  };
}

// ============================================
// METAFIELD HELPERS
// ============================================

async function getProductMetafield(env, productId, namespace, key) {
  const gid = productId.startsWith("gid://") ? productId : `gid://shopify/Product/${productId}`;

  const query = `
    query GetProductMetafield($id: ID!, $namespace: String!, $key: String!) {
      product(id: $id) {
        metafield(namespace: $namespace, key: $key) {
          id
          value
        }
      }
    }
  `;

  const result = await shopifyGraphQL(env, query, { id: gid, namespace, key });
  return result.product?.metafield || null;
}

async function deleteMetafield(env, ownerId, namespace, key) {
  const ownerGid = ownerId.startsWith("gid://") ? ownerId : `gid://shopify/Product/${ownerId}`;

  // Use metafieldsDelete with ownerId, namespace, and key
  const query = `
    mutation DeleteMetafields($metafields: [MetafieldIdentifierInput!]!) {
      metafieldsDelete(metafields: $metafields) {
        deletedMetafields {
          ownerId
          namespace
          key
        }
        userErrors { field message }
      }
    }
  `;

  const result = await shopifyGraphQL(env, query, {
    metafields: [{
      ownerId: ownerGid,
      namespace: namespace,
      key: key
    }]
  });

  if (result.metafieldsDelete.userErrors?.length > 0) {
    throw new Error(result.metafieldsDelete.userErrors.map(e => e.message).join(", "));
  }

  return {
    success: true,
    deletedMetafields: result.metafieldsDelete.deletedMetafields
  };
}

// ============================================
// VARIANT & OPTIONS OPERATIONS
// ============================================

/**
 * Update product options and create/update variants
 * @param {object} env - Environment variables
 * @param {string} productId - Product ID
 * @param {object} data - { options: [{ name: string, values: string[] }] }
 * 
 * Uses REST API to update product options and variants since GraphQL mutations
 * for options are limited in API 2024-01
 */
async function updateProductOptions(env, productId, data) {
  const numericId = productId.startsWith("gid://")
    ? productId.split('/').pop()
    : productId;

  const { options } = data;

  if (!options || !Array.isArray(options)) {
    throw new Error('Options array is required');
  }

  // Filter out empty options
  const validOptions = options.filter(o => o.name && o.values && o.values.length > 0);

  // Step 1: Get current product via REST API
  const getResponse = await fetch(
    `https://${env.SHOPIFY_DOMAIN}/admin/api/2024-01/products/${numericId}.json`,
    {
      method: 'GET',
      headers: {
        'X-Shopify-Access-Token': env.SHOPIFY_ACCESS_TOKEN,
        'Content-Type': 'application/json'
      }
    }
  );

  if (!getResponse.ok) {
    throw new Error(`Failed to get product: ${getResponse.status}`);
  }

  const currentData = await getResponse.json();
  const currentProduct = currentData.product;

  // If no valid options, reset to default
  if (validOptions.length === 0) {
    const resetPayload = {
      product: {
        id: numericId,
        options: [{ name: "Title" }],
        variants: [{
          option1: "Default Title",
          price: currentProduct.variants?.[0]?.price || "0.00"
        }]
      }
    };

    const resetResponse = await fetch(
      `https://${env.SHOPIFY_DOMAIN}/admin/api/2024-01/products/${numericId}.json`,
      {
        method: 'PUT',
        headers: {
          'X-Shopify-Access-Token': env.SHOPIFY_ACCESS_TOKEN,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(resetPayload)
      }
    );

    if (!resetResponse.ok) {
      const err = await resetResponse.text();
      throw new Error(`Failed to reset product: ${err}`);
    }

    return await getProductOptionsAndVariants(env, `gid://shopify/Product/${numericId}`);
  }

  // Step 2: Generate all variant combinations
  const combinations = generateOptionCombinations(validOptions);

  // Step 3: Build variants array for REST API
  // Each variant needs option1, option2, option3 based on position
  const variants = combinations.map(combo => {
    const variant = {};
    combo.forEach((opt, idx) => {
      variant[`option${idx + 1}`] = opt.value;
    });
    // Try to preserve price from existing variant with same options
    const existingVariant = currentProduct.variants?.find(v => {
      return combo.every((opt, idx) => v[`option${idx + 1}`] === opt.value);
    });
    if (existingVariant) {
      variant.price = existingVariant.price;
      variant.sku = existingVariant.sku;
      variant.inventory_quantity = existingVariant.inventory_quantity;
    }
    return variant;
  });

  // Step 4: Update product with new options and variants via REST API
  const updatePayload = {
    product: {
      id: numericId,
      options: validOptions.map(o => ({ name: o.name, values: o.values })),
      variants: variants
    }
  };

  console.log('[updateProductOptions] Sending payload:', JSON.stringify(updatePayload, null, 2));

  const updateResponse = await fetch(
    `https://${env.SHOPIFY_DOMAIN}/admin/api/2024-01/products/${numericId}.json`,
    {
      method: 'PUT',
      headers: {
        'X-Shopify-Access-Token': env.SHOPIFY_ACCESS_TOKEN,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(updatePayload)
    }
  );

  if (!updateResponse.ok) {
    const errText = await updateResponse.text();
    console.error('[updateProductOptions] Error response:', errText);
    throw new Error(`Failed to update product options: ${errText}`);
  }

  const updatedData = await updateResponse.json();
  console.log('[updateProductOptions] Success:', updatedData.product?.id);

  // Step 5: Return updated product options and variants via GraphQL for consistency
  return await getProductOptionsAndVariants(env, `gid://shopify/Product/${numericId}`);
}

/**
 * Generate all combinations of option values
 */
function generateOptionCombinations(options) {
  if (options.length === 0) return [];
  if (options.length === 1) {
    return options[0].values.map(v => [{ name: options[0].name, value: v }]);
  }

  const [first, ...rest] = options;
  const restCombos = generateOptionCombinations(rest);
  const result = [];

  for (const val of first.values) {
    for (const combo of restCombos) {
      result.push([{ name: first.name, value: val }, ...combo]);
    }
  }

  return result;
}

/**
 * Delete variants in bulk
 */
async function deleteVariantsBulk(env, productGid, variantIds) {
  if (!variantIds || variantIds.length === 0) return;

  const query = `
    mutation DeleteVariants($productId: ID!, $variantsIds: [ID!]!) {
      productVariantsBulkDelete(productId: $productId, variantsIds: $variantsIds) {
        product { id }
        userErrors { field message }
      }
    }
  `;

  const result = await shopifyGraphQL(env, query, {
    productId: productGid,
    variantsIds: variantIds
  });

  if (result.productVariantsBulkDelete?.userErrors?.length > 0) {
    console.error('Error deleting variants:', result.productVariantsBulkDelete.userErrors);
  }

  return result;
}

/**
 * Get product options and variants
 */
async function getProductOptionsAndVariants(env, productGid) {
  const query = `
    query GetProductOptionsAndVariants($id: ID!) {
      product(id: $id) {
        id
        options {
          id
          name
          position
          values
        }
        variants(first: 100) {
          edges {
            node {
              id
              title
              selectedOptions { name value }
            }
          }
        }
      }
    }
  `;

  const result = await shopifyGraphQL(env, query, { id: productGid });

  return {
    success: true,
    data: {
      options: result.product.options,
      variants: result.product.variants.edges.map(e => ({
        id: e.node.id,
        title: e.node.title,
        selectedOptions: e.node.selectedOptions
      }))
    }
  };
}

/**
 * Create product options and variants using REST API
 * @param {object} env - Environment variables
 * @param {string} productId - Product ID
 * @param {object} data - { options: [{ name, values }], variants: [{ options, price, sku, inventory }] }
 */
async function createProductVariants(env, productId, data) {
  const numericId = productId.startsWith("gid://") ? productId.split('/').pop() : productId;
  const { options, variants } = data;

  console.log('[CreateVariants] Starting for product:', numericId);
  console.log('[CreateVariants] Options:', JSON.stringify(options));
  console.log('[CreateVariants] Variants count:', variants?.length);

  if (!options || options.length === 0) {
    throw new Error("At least one option is required");
  }

  // Use REST API to update product with options and variants
  // This is more reliable than GraphQL for this operation
  const productData = {
    product: {
      id: numericId,
      options: options.map(opt => ({
        name: opt.name,
        values: opt.values
      })),
      variants: variants.map(v => {
        const variantObj = {
          price: String(v.price || 0),
          sku: v.sku || '',
          inventory_management: 'shopify',
          inventory_quantity: v.inventory || 0
        };

        // Add option values
        v.options.forEach((optValue, idx) => {
          variantObj[`option${idx + 1}`] = optValue;
        });

        return variantObj;
      })
    }
  };

  console.log('[CreateVariants] Sending to REST API:', JSON.stringify(productData));

  const response = await fetch(
    `https://${env.SHOPIFY_DOMAIN}/admin/api/2024-01/products/${numericId}.json`,
    {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': env.SHOPIFY_ACCESS_TOKEN
      },
      body: JSON.stringify(productData)
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[CreateVariants] REST API error:', errorText);
    throw new Error(`Failed to create variants: ${response.status} ${errorText}`);
  }

  const result = await response.json();
  console.log('[CreateVariants] Success, variants created:', result.product?.variants?.length);

  // Set inventory and B2B price for each variant if needed
  if (result.product?.variants) {
    for (let i = 0; i < result.product.variants.length; i++) {
      const variant = result.product.variants[i];
      const variantData = variants[i];

      // Set inventory
      if (variant.inventory_item_id && variantData?.inventory > 0) {
        try {
          const inventoryItemGid = `gid://shopify/InventoryItem/${variant.inventory_item_id}`;
          await setInventoryQuantity(env, inventoryItemGid, variantData.inventory);
          console.log(`[CreateVariants] Set inventory for variant ${variant.id}: ${variantData.inventory}`);
        } catch (invErr) {
          console.error(`[CreateVariants] Failed to set inventory for variant ${variant.id}:`, invErr.message);
        }
      }

      // Set B2B price if provided
      if (variantData?.b2bPrice !== null && variantData?.b2bPrice !== undefined && variantData?.b2bPrice !== '') {
        try {
          const variantGid = `gid://shopify/ProductVariant/${variant.id}`;
          await setVariantB2BPrice(env, variantGid, variantData.b2bPrice);
          console.log(`[CreateVariants] Set B2B price for variant ${variant.id}: ${variantData.b2bPrice}`);
        } catch (b2bErr) {
          console.error(`[CreateVariants] Failed to set B2B price for variant ${variant.id}:`, b2bErr.message);
        }
      }
    }

    // Calculate and set the cheapest variant price as the product's display price
    // This ensures product cards show "From $X" pricing
    try {
      const cheapestVariantPrice = Math.min(...result.product.variants.map(v => parseFloat(v.price) || Infinity));
      if (cheapestVariantPrice !== Infinity && cheapestVariantPrice > 0) {
        console.log(`[CreateVariants] Setting product base price to cheapest variant: ${cheapestVariantPrice}`);
        // The first variant's price is used by Shopify for product.price_min
        // No additional action needed - Shopify automatically calculates price_min from variants
      }
    } catch (priceErr) {
      console.error('[CreateVariants] Failed to calculate cheapest price:', priceErr.message);
    }

    // Set product-level B2B price metafield to the lowest variant B2B price
    const productGid = `gid://shopify/Product/${numericId}`;
    const variantsWithB2b = variants.filter(v => v.b2bPrice !== null && v.b2bPrice !== undefined && v.b2bPrice !== '');
    if (variantsWithB2b.length > 0) {
      const lowestB2bPrice = Math.min(...variantsWithB2b.map(v => parseFloat(v.b2bPrice) || Infinity));
      if (lowestB2bPrice !== Infinity && lowestB2bPrice > 0) {
        try {
          const updateProductMetafieldQuery = `
            mutation UpdateProductB2BPrice($metafields: [MetafieldsSetInput!]!) {
              metafieldsSet(metafields: $metafields) {
                metafields { id key value }
                userErrors { field message }
              }
            }
          `;

          await shopifyGraphQL(env, updateProductMetafieldQuery, {
            metafields: [{
              ownerId: productGid,
              namespace: "custom",
              key: "b2b_price",
              type: "number_decimal",
              value: formatPrice(lowestB2bPrice)
            }]
          });

          console.log(`[CreateVariants] Set product B2B price to lowest variant B2B: ${lowestB2bPrice}`);
        } catch (e) {
          console.error('[CreateVariants] Failed to update product B2B price:', e.message);
        }
      }
    }

    // Set product-level discount price metafield to the lowest variant discount price
    const variantsWithDiscount = variants.filter(v => v.discountPrice !== null && v.discountPrice !== undefined && v.discountPrice !== '');
    if (variantsWithDiscount.length > 0) {
      const lowestDiscountPrice = Math.min(...variantsWithDiscount.map(v => parseFloat(v.discountPrice) || Infinity));
      if (lowestDiscountPrice !== Infinity && lowestDiscountPrice > 0) {
        try {
          const updateProductMetafieldQuery = `
            mutation UpdateProductDiscountPrice($metafields: [MetafieldsSetInput!]!) {
              metafieldsSet(metafields: $metafields) {
                metafields { id key value }
                userErrors { field message }
              }
            }
          `;

          await shopifyGraphQL(env, updateProductMetafieldQuery, {
            metafields: [{
              ownerId: productGid,
              namespace: "custom",
              key: "discount_price",
              type: "number_decimal",
              value: formatPrice(lowestDiscountPrice)
            }]
          });

          console.log(`[CreateVariants] Set product discount price to lowest variant discount: ${lowestDiscountPrice}`);
        } catch (e) {
          console.error('[CreateVariants] Failed to update product discount price:', e.message);
        }
      }
    }
  }

  return {
    success: true,
    data: {
      options: result.product?.options || [],
      variants: result.product?.variants?.map(v => ({
        id: `gid://shopify/ProductVariant/${v.id}`,
        title: v.title,
        price: v.price,
        sku: v.sku,
        inventory: v.inventory_quantity
      })) || []
    }
  };
}

/**
 * Bulk update variants with pricing, SKU, inventory, and B2B price
 * @param {object} env - Environment variables
 * @param {string} productId - Product ID
 * @param {object} data - { variants: [{ id, price, compareAtPrice, sku, inventory, b2bPrice }] }
 */
async function updateProductVariants(env, productId, data) {
  const gid = productId.startsWith("gid://") ? productId : `gid://shopify/Product/${productId}`;
  const numericProductId = productId.startsWith("gid://") ? productId.split('/').pop() : productId;
  const { variants } = data;

  if (!variants || !Array.isArray(variants) || variants.length === 0) {
    throw new Error('Variants array is required');
  }

  // Step 1: Bulk update variant prices using GraphQL (without SKU - not supported in bulk input)
  const variantInputs = variants.map(v => {
    const variantGid = v.id.startsWith("gid://") ? v.id : `gid://shopify/ProductVariant/${v.id}`;
    const input = { id: variantGid };

    if (v.price !== undefined) input.price = formatPrice(v.price);
    if (v.compareAtPrice !== undefined) input.compareAtPrice = v.compareAtPrice ? formatPrice(v.compareAtPrice) : null;

    return input;
  });

  const bulkUpdateQuery = `
    mutation BulkUpdateVariants($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
      productVariantsBulkUpdate(productId: $productId, variants: $variants) {
        productVariants {
          id
          title
          price
          compareAtPrice
          sku
          inventoryQuantity
        }
        userErrors { field message }
      }
    }
  `;

  const bulkResult = await shopifyGraphQL(env, bulkUpdateQuery, {
    productId: gid,
    variants: variantInputs
  });

  if (bulkResult.productVariantsBulkUpdate?.userErrors?.length > 0) {
    throw new Error(bulkResult.productVariantsBulkUpdate.userErrors.map(e => e.message).join(", "));
  }

  // Step 2: Update SKUs via REST API (GraphQL bulk doesn't support SKU)
  const skuUpdates = [];
  for (const v of variants) {
    if (v.sku !== undefined) {
      const variantNumericId = v.id.startsWith("gid://") ? v.id.split('/').pop() : v.id;
      try {
        const skuResponse = await fetch(
          `https://${env.SHOPIFY_DOMAIN}/admin/api/2024-01/variants/${variantNumericId}.json`,
          {
            method: 'PUT',
            headers: {
              'X-Shopify-Access-Token': env.SHOPIFY_ACCESS_TOKEN,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ variant: { id: variantNumericId, sku: v.sku || '' } })
          }
        );

        if (skuResponse.ok) {
          skuUpdates.push({ id: v.id, sku: v.sku, success: true });
        } else {
          const errText = await skuResponse.text();
          skuUpdates.push({ id: v.id, sku: v.sku, success: false, error: errText });
        }
      } catch (e) {
        skuUpdates.push({ id: v.id, sku: v.sku, success: false, error: e.message });
      }
    }
  }

  // Step 3: Update B2B prices as metafields on each variant
  const b2bUpdates = [];
  for (const v of variants) {
    if (v.b2bPrice !== undefined) {
      const variantGid = v.id.startsWith("gid://") ? v.id : `gid://shopify/ProductVariant/${v.id}`;
      try {
        await setVariantB2BPrice(env, variantGid, v.b2bPrice);
        b2bUpdates.push({ id: variantGid, b2bPrice: v.b2bPrice, success: true });
      } catch (e) {
        b2bUpdates.push({ id: variantGid, b2bPrice: v.b2bPrice, success: false, error: e.message });
      }
    }
  }

  // Step 3.5: Update discount prices as metafields on each variant
  const discountUpdates = [];
  for (const v of variants) {
    if (v.discountPrice !== undefined) {
      const variantGid = v.id.startsWith("gid://") ? v.id : `gid://shopify/ProductVariant/${v.id}`;
      try {
        await setVariantDiscountPrice(env, variantGid, v.discountPrice);
        discountUpdates.push({ id: variantGid, discountPrice: v.discountPrice, success: true });
      } catch (e) {
        discountUpdates.push({ id: variantGid, discountPrice: v.discountPrice, success: false, error: e.message });
      }
    }
  }

  // Step 4: Update inventory for each variant
  const inventoryUpdates = [];
  for (const v of variants) {
    if (v.inventory !== undefined) {
      const variantGid = v.id.startsWith("gid://") ? v.id : `gid://shopify/ProductVariant/${v.id}`;
      try {
        const invResult = await updateVariantInventory(env, variantGid, v.inventory);
        inventoryUpdates.push({ id: variantGid, inventory: v.inventory, success: true, result: invResult });
      } catch (e) {
        inventoryUpdates.push({ id: variantGid, inventory: v.inventory, success: false, error: e.message });
      }
    }
  }

  // Step 5: Update product-level B2B price metafield to the lowest variant B2B price
  // This ensures the product card shows the correct "From $X" B2B price
  let productB2bPriceUpdate = null;
  const variantsWithB2b = variants.filter(v => v.b2bPrice !== undefined && v.b2bPrice !== null && v.b2bPrice !== '');
  if (variantsWithB2b.length > 0) {
    const lowestB2bPrice = Math.min(...variantsWithB2b.map(v => parseFloat(v.b2bPrice) || Infinity));
    if (lowestB2bPrice !== Infinity && lowestB2bPrice > 0) {
      try {
        const updateProductMetafieldQuery = `
          mutation UpdateProductB2BPrice($metafields: [MetafieldsSetInput!]!) {
            metafieldsSet(metafields: $metafields) {
              metafields { id key value }
              userErrors { field message }
            }
          }
        `;

        await shopifyGraphQL(env, updateProductMetafieldQuery, {
          metafields: [{
            ownerId: gid,
            namespace: "custom",
            key: "b2b_price",
            type: "number_decimal",
            value: formatPrice(lowestB2bPrice)
          }]
        });

        productB2bPriceUpdate = { success: true, lowestB2bPrice };
        console.log(`[UpdateVariants] Set product B2B price to lowest variant B2B: ${lowestB2bPrice}`);
      } catch (e) {
        productB2bPriceUpdate = { success: false, error: e.message };
        console.error('[UpdateVariants] Failed to update product B2B price:', e.message);
      }
    }
  }

  // Step 6: Update product-level discount price metafield to the lowest variant discount price
  let productDiscountPriceUpdate = null;
  const variantsWithDiscount = variants.filter(v => v.discountPrice !== undefined && v.discountPrice !== null && v.discountPrice !== '');
  if (variantsWithDiscount.length > 0) {
    const lowestDiscountPrice = Math.min(...variantsWithDiscount.map(v => parseFloat(v.discountPrice) || Infinity));
    if (lowestDiscountPrice !== Infinity && lowestDiscountPrice > 0) {
      try {
        const updateProductMetafieldQuery = `
          mutation UpdateProductDiscountPrice($metafields: [MetafieldsSetInput!]!) {
            metafieldsSet(metafields: $metafields) {
              metafields { id key value }
              userErrors { field message }
            }
          }
        `;

        await shopifyGraphQL(env, updateProductMetafieldQuery, {
          metafields: [{
            ownerId: gid,
            namespace: "custom",
            key: "discount_price",
            type: "number_decimal",
            value: formatPrice(lowestDiscountPrice)
          }]
        });

        productDiscountPriceUpdate = { success: true, lowestDiscountPrice };
        console.log(`[UpdateVariants] Set product discount price to lowest variant discount: ${lowestDiscountPrice}`);
      } catch (e) {
        productDiscountPriceUpdate = { success: false, error: e.message };
        console.error('[UpdateVariants] Failed to update product discount price:', e.message);
      }
    }
  }

  return {
    success: true,
    data: {
      variants: bulkResult.productVariantsBulkUpdate.productVariants,
      skuUpdates,
      b2bUpdates,
      discountUpdates,
      inventoryUpdates,
      productB2bPriceUpdate,
      productDiscountPriceUpdate
    }
  };
}

/**
 * Ensure the variant b2b_price metafield definition exists
 * This is REQUIRED for Shopify Functions (cart-transform) to access variant metafields
 */
let variantB2bPriceDefinitionEnsured = false;
async function ensureVariantB2bPriceDefinition(env) {
  if (variantB2bPriceDefinitionEnsured) {
    return { cached: true };
  }

  // Check if definition already exists for PRODUCTVARIANT
  const checkQuery = `
    query CheckVariantB2bMetafieldDefinition {
      metafieldDefinitions(first: 50, ownerType: PRODUCTVARIANT, namespace: "custom") {
        edges {
          node {
            id
            key
            namespace
            access {
              storefront
            }
          }
        }
      }
    }
  `;

  const checkResult = await shopifyGraphQL(env, checkQuery, {});
  const existing = checkResult.metafieldDefinitions?.edges?.find(
    e => e.node.namespace === "custom" && e.node.key === "b2b_price"
  );

  if (existing) {
    console.log(`[ensureVariantB2bPriceDefinition] Definition exists, storefront access: ${existing.node.access?.storefront}`);
    variantB2bPriceDefinitionEnsured = true;
    return { exists: true, id: existing.node.id };
  }

  // Create the definition for PRODUCTVARIANT
  const createQuery = `
    mutation CreateVariantB2bPriceDefinition($definition: MetafieldDefinitionInput!) {
      metafieldDefinitionCreate(definition: $definition) {
        createdDefinition {
          id
          key
          namespace
        }
        userErrors { field message }
      }
    }
  `;

  const createResult = await shopifyGraphQL(env, createQuery, {
    definition: {
      name: "Variant B2B Price",
      namespace: "custom",
      key: "b2b_price",
      type: "number_decimal",
      ownerType: "PRODUCTVARIANT",
      access: {
        storefront: "PUBLIC_READ"
      }
    }
  });

  if (createResult.metafieldDefinitionCreate?.userErrors?.length > 0) {
    console.log("Variant B2B price definition error:", createResult.metafieldDefinitionCreate.userErrors);
  } else {
    console.log("[ensureVariantB2bPriceDefinition] Created new definition");
  }

  variantB2bPriceDefinitionEnsured = true;
  return { created: true, definition: createResult.metafieldDefinitionCreate?.createdDefinition };
}

/**
 * Set B2B price metafield on a variant
 */
async function setVariantB2BPrice(env, variantId, b2bPrice) {
  const gid = variantId.startsWith("gid://") ? variantId : `gid://shopify/ProductVariant/${variantId}`;

  // Ensure the metafield definition exists (required for Shopify Functions access)
  await ensureVariantB2bPriceDefinition(env);

  if (!b2bPrice || b2bPrice === '' || b2bPrice === null) {
    // Delete the metafield if price is empty
    try {
      await deleteMetafield(env, gid, "custom", "b2b_price");
    } catch (e) {
      // Ignore if metafield doesn't exist
    }
    return { success: true, deleted: true };
  }

  const query = `
    mutation SetVariantB2BPrice($metafields: [MetafieldsSetInput!]!) {
      metafieldsSet(metafields: $metafields) {
        metafields {
          id
          key
          value
        }
        userErrors { field message }
      }
    }
  `;

  const result = await shopifyGraphQL(env, query, {
    metafields: [{
      ownerId: gid,
      namespace: "custom",
      key: "b2b_price",
      type: "number_decimal",
      value: formatPrice(b2bPrice)
    }]
  });

  if (result.metafieldsSet.userErrors?.length > 0) {
    throw new Error(result.metafieldsSet.userErrors.map(e => e.message).join(", "));
  }

  return { success: true, metafield: result.metafieldsSet.metafields[0] };
}

/**
 * Ensure the variant discount_price metafield definition exists
 * This is REQUIRED for Shopify Functions (cart-transform) to access variant metafields
 */
let variantDiscountPriceDefinitionEnsured = false;
async function ensureVariantDiscountPriceDefinition(env) {
  if (variantDiscountPriceDefinitionEnsured) {
    return { cached: true };
  }

  // Check if definition already exists for PRODUCTVARIANT
  const checkQuery = `
    query CheckVariantMetafieldDefinition {
      metafieldDefinitions(first: 50, ownerType: PRODUCTVARIANT, namespace: "custom") {
        edges {
          node {
            id
            key
            namespace
            access {
              storefront
            }
          }
        }
      }
    }
  `;

  const checkResult = await shopifyGraphQL(env, checkQuery, {});
  const existing = checkResult.metafieldDefinitions?.edges?.find(
    e => e.node.namespace === "custom" && e.node.key === "discount_price"
  );

  if (existing) {
    console.log(`[ensureVariantDiscountPriceDefinition] Definition exists, storefront access: ${existing.node.access?.storefront}`);
    variantDiscountPriceDefinitionEnsured = true;
    return { exists: true, id: existing.node.id };
  }

  // Create the definition for PRODUCTVARIANT
  const createQuery = `
    mutation CreateVariantDiscountPriceDefinition($definition: MetafieldDefinitionInput!) {
      metafieldDefinitionCreate(definition: $definition) {
        createdDefinition {
          id
          key
          namespace
        }
        userErrors { field message }
      }
    }
  `;

  const createResult = await shopifyGraphQL(env, createQuery, {
    definition: {
      name: "Variant Discount Price",
      namespace: "custom",
      key: "discount_price",
      type: "number_decimal",
      ownerType: "PRODUCTVARIANT",
      access: {
        storefront: "PUBLIC_READ"
      }
    }
  });

  if (createResult.metafieldDefinitionCreate?.userErrors?.length > 0) {
    console.log("Variant discount price definition error:", createResult.metafieldDefinitionCreate.userErrors);
    // Don't throw - definition might already exist with different settings
  } else {
    console.log("[ensureVariantDiscountPriceDefinition] Created new definition");
  }

  variantDiscountPriceDefinitionEnsured = true;
  return { created: true, definition: createResult.metafieldDefinitionCreate?.createdDefinition };
}

/**
 * Set discount price metafield on a variant
 */
async function setVariantDiscountPrice(env, variantId, discountPrice) {
  const gid = variantId.startsWith("gid://") ? variantId : `gid://shopify/ProductVariant/${variantId}`;

  // Ensure the metafield definition exists (required for Shopify Functions access)
  await ensureVariantDiscountPriceDefinition(env);

  if (!discountPrice || discountPrice === '' || discountPrice === null) {
    // Delete the metafield if price is empty
    try {
      await deleteMetafield(env, gid, "custom", "discount_price");
    } catch (e) {
      // Ignore if metafield doesn't exist
    }
    return { success: true, deleted: true };
  }

  const query = `
    mutation SetVariantDiscountPrice($metafields: [MetafieldsSetInput!]!) {
      metafieldsSet(metafields: $metafields) {
        metafields {
          id
          key
          value
        }
        userErrors { field message }
      }
    }
  `;

  const result = await shopifyGraphQL(env, query, {
    metafields: [{
      ownerId: gid,
      namespace: "custom",
      key: "discount_price",
      type: "number_decimal",
      value: formatPrice(discountPrice)
    }]
  });

  if (result.metafieldsSet.userErrors?.length > 0) {
    throw new Error(result.metafieldsSet.userErrors.map(e => e.message).join(", "));
  }

  return { success: true, metafield: result.metafieldsSet.metafields[0] };
}

/**
 * Save add-on options as a product metafield
/**
 * Ensure the addon_options metafield definition exists
 * This is required for the metafield to be accessible on the storefront
 */
async function ensureAddonOptionsDefinition(env) {
  // First check if definition already exists
  const checkQuery = `
    query CheckMetafieldDefinition {
      metafieldDefinitions(first: 50, ownerType: PRODUCT, namespace: "custom") {
        edges {
          node {
            id
            key
            namespace
            access {
              storefront
            }
          }
        }
      }
    }
  `;

  const checkResult = await shopifyGraphQL(env, checkQuery, {});
  const existing = checkResult.metafieldDefinitions?.edges?.find(
    e => e.node.namespace === "custom" && e.node.key === "add_on_options"
  );

  if (existing) {
    // Check if storefront access is enabled
    const hasStorefrontAccess = existing.node.access?.storefront === "PUBLIC_READ";
    console.log(`[ensureAddonOptionsDefinition] Definition exists, storefront access: ${existing.node.access?.storefront}`);

    if (!hasStorefrontAccess) {
      // Update the definition to enable storefront access
      console.log("[ensureAddonOptionsDefinition] Updating definition to enable storefront access");
      const updateQuery = `
        mutation UpdateMetafieldDefinition($definition: MetafieldDefinitionUpdateInput!) {
          metafieldDefinitionUpdate(definition: $definition) {
            updatedDefinition {
              id
              access {
                storefront
              }
            }
            userErrors { field message }
          }
        }
      `;

      const updateResult = await shopifyGraphQL(env, updateQuery, {
        definition: {
          id: existing.node.id,
          access: {
            storefront: "PUBLIC_READ"
          }
        }
      });

      if (updateResult.metafieldDefinitionUpdate?.userErrors?.length > 0) {
        console.log("Metafield definition update error:", updateResult.metafieldDefinitionUpdate.userErrors);
      } else {
        console.log("[ensureAddonOptionsDefinition] Storefront access enabled");
      }
    }

    return { exists: true, id: existing.node.id };
  }

  // Create the definition
  const createQuery = `
    mutation CreateMetafieldDefinition($definition: MetafieldDefinitionInput!) {
      metafieldDefinitionCreate(definition: $definition) {
        createdDefinition {
          id
          key
          namespace
        }
        userErrors { field message }
      }
    }
  `;

  const createResult = await shopifyGraphQL(env, createQuery, {
    definition: {
      name: "Add-on Options",
      namespace: "custom",
      key: "add_on_options",
      type: "json",
      ownerType: "PRODUCT",
      access: {
        storefront: "PUBLIC_READ"
      }
    }
  });

  if (createResult.metafieldDefinitionCreate?.userErrors?.length > 0) {
    console.log("Metafield definition error:", createResult.metafieldDefinitionCreate.userErrors);
    // Don't throw - definition might already exist with different settings
  }

  return { created: true, definition: createResult.metafieldDefinitionCreate?.createdDefinition };
}

/**
 * Save add-on options as a product metafield
 * Add-on options are stored as JSON and don't create separate variants
 * They modify price at checkout but don't affect inventory
 */
async function saveProductAddOns(env, productId, addOnOptions) {
  const gid = productId.startsWith("gid://") ? productId : `gid://shopify/Product/${productId}`;

  console.log(`[saveProductAddOns] productId=${productId}, addOnOptions count=${addOnOptions?.length || 0}`);

  // Ensure the metafield definition exists (required for storefront access)
  try {
    await ensureAddonOptionsDefinition(env);
  } catch (e) {
    console.log("Could not ensure metafield definition:", e.message);
  }

  if (!addOnOptions || addOnOptions.length === 0) {
    // Delete the metafield if no add-ons
    console.log(`[saveProductAddOns] Deleting metafield for ${gid}`);
    try {
      const deleteResult = await deleteMetafield(env, gid, "custom", "add_on_options");
      console.log(`[saveProductAddOns] Delete result:`, JSON.stringify(deleteResult));
    } catch (e) {
      console.log(`[saveProductAddOns] Delete error (may be ok if not exists):`, e.message);
    }
    return { success: true, deleted: true };
  }

  // Format add-on options for storage
  const addOnsData = addOnOptions.map(opt => ({
    name: opt.name,
    values: opt.values,
    priceModifiers: opt.priceModifiers || {}
  }));

  const query = `
    mutation SetProductAddOns($metafields: [MetafieldsSetInput!]!) {
      metafieldsSet(metafields: $metafields) {
        metafields {
          id
          key
          value
        }
        userErrors { field message }
      }
    }
  `;

  const result = await shopifyGraphQL(env, query, {
    metafields: [{
      ownerId: gid,
      namespace: "custom",
      key: "add_on_options",
      type: "json",
      value: JSON.stringify(addOnsData)
    }]
  });

  if (result.metafieldsSet.userErrors?.length > 0) {
    throw new Error(result.metafieldsSet.userErrors.map(e => e.message).join(", "));
  }

  return { success: true, metafield: result.metafieldsSet.metafields[0], addOns: addOnsData };
}

/**
 * Update inventory for a specific variant
 */
async function updateVariantInventory(env, variantId, quantity) {
  const gid = variantId.startsWith("gid://") ? variantId : `gid://shopify/ProductVariant/${variantId}`;

  // Get the inventory item ID for this variant
  const getQuery = `
    query GetVariantInventory($id: ID!) {
      productVariant(id: $id) {
        id
        inventoryItem {
          id
          tracked
          inventoryLevels(first: 1) {
            edges {
              node {
                id
                location {
                  id
                }
                quantities(names: ["available"]) {
                  name
                  quantity
                }
              }
            }
          }
        }
      }
    }
  `;

  const getResult = await shopifyGraphQL(env, getQuery, { id: gid });
  const inventoryItem = getResult.productVariant?.inventoryItem;

  if (!inventoryItem) {
    throw new Error('Inventory item not found for variant');
  }

  if (!inventoryItem.tracked) {
    return { success: true, message: 'Inventory not tracked', quantity: null };
  }

  const inventoryLevel = inventoryItem.inventoryLevels?.edges?.[0]?.node;
  if (!inventoryLevel) {
    throw new Error('No inventory level found');
  }

  const locationId = inventoryLevel.location.id;
  const currentQty = inventoryLevel.quantities?.[0]?.quantity || 0;
  const targetQty = parseInt(quantity) || 0;
  const delta = targetQty - currentQty;

  if (delta === 0) {
    return { success: true, message: 'No change needed', quantity: currentQty };
  }

  const adjustQuery = `
    mutation AdjustInventory($input: InventoryAdjustQuantitiesInput!) {
      inventoryAdjustQuantities(input: $input) {
        inventoryAdjustmentGroup {
          changes {
            quantityAfterChange
          }
        }
        userErrors { field message }
      }
    }
  `;

  const adjustResult = await shopifyGraphQL(env, adjustQuery, {
    input: {
      name: "available",
      reason: "correction",
      changes: [{
        inventoryItemId: inventoryItem.id,
        locationId: locationId,
        delta: delta
      }]
    }
  });

  if (adjustResult.inventoryAdjustQuantities?.userErrors?.length > 0) {
    throw new Error(adjustResult.inventoryAdjustQuantities.userErrors.map(e => e.message).join(", "));
  }

  const finalQty = adjustResult.inventoryAdjustQuantities?.inventoryAdjustmentGroup?.changes?.[0]?.quantityAfterChange;
  return { success: true, quantity: finalQty };
}

/**
 * Update media alt text (for option value tagging)
 */
async function updateMediaAlt(env, productId, mediaId, altText) {
  const productGid = productId.startsWith("gid://") ? productId : `gid://shopify/Product/${productId}`;

  // Decode the mediaId in case it's URL-encoded
  let decodedMediaId = decodeURIComponent(mediaId);
  let mediaGid = decodedMediaId;

  // Handle various media ID formats
  if (!decodedMediaId.startsWith("gid://")) {
    mediaGid = `gid://shopify/MediaImage/${decodedMediaId}`;
  }

  const query = `
    mutation UpdateMediaAlt($productId: ID!, $media: [UpdateMediaInput!]!) {
      productUpdateMedia(productId: $productId, media: $media) {
        media {
          ... on MediaImage {
            id
            image {
              altText
            }
          }
        }
        mediaUserErrors { field message }
      }
    }
  `;

  const result = await shopifyGraphQL(env, query, {
    productId: productGid,
    media: [{
      id: mediaGid,
      alt: altText || ''
    }]
  });

  if (result.productUpdateMedia?.mediaUserErrors?.length > 0) {
    throw new Error(result.productUpdateMedia.mediaUserErrors.map(e => e.message).join(", "));
  }

  return {
    success: true,
    data: result.productUpdateMedia.media[0]
  };
}

// ============================================
// SHIPPING OPERATIONS
// ============================================

/**
 * List all packages (custom + carrier)
 * Uses Shopify's CarrierService and custom metaobjects for package storage
 */
async function listPackages(env) {
  // Get custom packages from metaobjects
  const customPackages = await getCustomPackages(env);

  // Get carrier packages from Shopify
  const carrierPackages = await getCarrierPackages(env);

  // Get default package ID from shop metafield
  const defaultPackageId = await getDefaultPackageId(env);

  return {
    success: true,
    data: {
      customPackages,
      carrierPackages,
      defaultPackageId
    }
  };
}

/**
 * Get custom packages stored as metaobjects
 */
async function getCustomPackages(env) {
  const query = `
    query GetCustomPackages {
      metaobjects(type: "shipping_package", first: 50) {
        edges {
          node {
            id
            handle
            fields {
              key
              value
            }
          }
        }
      }
    }
  `;

  try {
    const result = await shopifyGraphQL(env, query, {});

    if (!result.metaobjects?.edges) {
      return [];
    }

    return result.metaobjects.edges.map(({ node }) => {
      const pkg = { id: node.id, handle: node.handle };
      node.fields.forEach(field => {
        if (field.key === 'length' || field.key === 'width' || field.key === 'height' || field.key === 'weight') {
          pkg[field.key] = parseFloat(field.value) || 0;
        } else {
          pkg[field.key] = field.value;
        }
      });
      pkg.isCustom = true;
      return pkg;
    });
  } catch (e) {
    console.error('[GetCustomPackages] Error:', e.message);
    return [];
  }
}

/**
 * Get carrier packages from Shopify's fulfillment services
 * These are predefined packages from carriers like USPS, UPS, FedEx
 */
async function getCarrierPackages(env) {
  // Shopify doesn't have a direct GraphQL API for carrier packages
  // We'll use REST API to get carrier services and their packages
  try {
    const response = await fetch(
      `https://${env.SHOPIFY_DOMAIN}/admin/api/2024-01/carrier_services.json`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': env.SHOPIFY_ACCESS_TOKEN
        }
      }
    );

    if (!response.ok) {
      console.log('[GetCarrierPackages] No carrier services available');
      return getDefaultCarrierPackages();
    }

    const data = await response.json();

    // If no carrier services, return default carrier packages
    if (!data.carrier_services || data.carrier_services.length === 0) {
      return getDefaultCarrierPackages();
    }

    // Return default carrier packages (Shopify doesn't expose carrier package details via API)
    return getDefaultCarrierPackages();
  } catch (e) {
    console.error('[GetCarrierPackages] Error:', e.message);
    return getDefaultCarrierPackages();
  }
}

/**
 * Default carrier packages (common shipping packages)
 */
function getDefaultCarrierPackages() {
  return [
    // USPS Packages
    { id: 'usps_flat_rate_envelope', name: 'USPS Flat Rate Envelope', carrier: 'USPS', type: 'envelope', length: 12.5, width: 9.5, height: 0.75, sizeUnit: 'in', weight: 0, weightUnit: 'oz' },
    { id: 'usps_flat_rate_padded_envelope', name: 'USPS Flat Rate Padded Envelope', carrier: 'USPS', type: 'envelope', length: 12.5, width: 9.5, height: 1, sizeUnit: 'in', weight: 0, weightUnit: 'oz' },
    { id: 'usps_small_flat_rate_box', name: 'USPS Small Flat Rate Box', carrier: 'USPS', type: 'box', length: 8.69, width: 5.44, height: 1.75, sizeUnit: 'in', weight: 0, weightUnit: 'oz' },
    { id: 'usps_medium_flat_rate_box', name: 'USPS Medium Flat Rate Box', carrier: 'USPS', type: 'box', length: 11.25, width: 8.75, height: 6, sizeUnit: 'in', weight: 0, weightUnit: 'oz' },
    { id: 'usps_large_flat_rate_box', name: 'USPS Large Flat Rate Box', carrier: 'USPS', type: 'box', length: 12.25, width: 12.25, height: 6, sizeUnit: 'in', weight: 0, weightUnit: 'oz' },
    { id: 'usps_regional_rate_box_a', name: 'USPS Regional Rate Box A', carrier: 'USPS', type: 'box', length: 10.13, width: 7.13, height: 5, sizeUnit: 'in', weight: 0, weightUnit: 'oz' },
    { id: 'usps_regional_rate_box_b', name: 'USPS Regional Rate Box B', carrier: 'USPS', type: 'box', length: 12.25, width: 10.5, height: 5.5, sizeUnit: 'in', weight: 0, weightUnit: 'oz' },

    // UPS Packages
    { id: 'ups_express_box_small', name: 'UPS Express Box Small', carrier: 'UPS', type: 'box', length: 13, width: 11, height: 2, sizeUnit: 'in', weight: 0, weightUnit: 'oz' },
    { id: 'ups_express_box_medium', name: 'UPS Express Box Medium', carrier: 'UPS', type: 'box', length: 16, width: 11, height: 3, sizeUnit: 'in', weight: 0, weightUnit: 'oz' },
    { id: 'ups_express_box_large', name: 'UPS Express Box Large', carrier: 'UPS', type: 'box', length: 18, width: 13, height: 3, sizeUnit: 'in', weight: 0, weightUnit: 'oz' },
    { id: 'ups_express_pak', name: 'UPS Express Pak', carrier: 'UPS', type: 'soft_package', length: 16, width: 11.75, height: 1.5, sizeUnit: 'in', weight: 0, weightUnit: 'oz' },
    { id: 'ups_express_tube', name: 'UPS Express Tube', carrier: 'UPS', type: 'soft_package', length: 38, width: 6, height: 6, sizeUnit: 'in', weight: 0, weightUnit: 'oz' },

    // FedEx Packages
    { id: 'fedex_envelope', name: 'FedEx Envelope', carrier: 'FedEx', type: 'envelope', length: 12.5, width: 9.5, height: 0.5, sizeUnit: 'in', weight: 0, weightUnit: 'oz' },
    { id: 'fedex_pak', name: 'FedEx Pak', carrier: 'FedEx', type: 'soft_package', length: 15.5, width: 12, height: 1, sizeUnit: 'in', weight: 0, weightUnit: 'oz' },
    { id: 'fedex_small_box', name: 'FedEx Small Box', carrier: 'FedEx', type: 'box', length: 12.38, width: 10.88, height: 1.5, sizeUnit: 'in', weight: 0, weightUnit: 'oz' },
    { id: 'fedex_medium_box', name: 'FedEx Medium Box', carrier: 'FedEx', type: 'box', length: 13.25, width: 11.5, height: 2.38, sizeUnit: 'in', weight: 0, weightUnit: 'oz' },
    { id: 'fedex_large_box', name: 'FedEx Large Box', carrier: 'FedEx', type: 'box', length: 17.88, width: 12.38, height: 3, sizeUnit: 'in', weight: 0, weightUnit: 'oz' },
    { id: 'fedex_extra_large_box', name: 'FedEx Extra Large Box', carrier: 'FedEx', type: 'box', length: 15.75, width: 14.13, height: 6, sizeUnit: 'in', weight: 0, weightUnit: 'oz' },
    { id: 'fedex_tube', name: 'FedEx Tube', carrier: 'FedEx', type: 'soft_package', length: 38, width: 6, height: 6, sizeUnit: 'in', weight: 0, weightUnit: 'oz' }
  ];
}

/**
 * Get default package ID from shop metafield
 */
async function getDefaultPackageId(env) {
  const query = `
    query GetShopMetafield {
      shop {
        metafield(namespace: "shipping", key: "default_package_id") {
          value
        }
      }
    }
  `;

  try {
    const result = await shopifyGraphQL(env, query, {});
    return result.shop?.metafield?.value || null;
  } catch (e) {
    console.error('[GetDefaultPackageId] Error:', e.message);
    return null;
  }
}

/**
 * Create a custom package (stored as metaobject)
 */
async function createPackage(env, data) {
  const { name, type, length, width, height, sizeUnit, weight, weightUnit, setAsDefault } = data;

  if (!name || !type || !length || !width || !height) {
    throw new Error('Name, type, and dimensions are required');
  }

  // First ensure the metaobject definition exists
  await ensurePackageDefinition(env);

  // Create handle from name
  const handle = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  const query = `
    mutation CreatePackage($metaobject: MetaobjectCreateInput!) {
      metaobjectCreate(metaobject: $metaobject) {
        metaobject {
          id
          handle
          fields { key value }
        }
        userErrors { field message }
      }
    }
  `;

  const variables = {
    metaobject: {
      type: "shipping_package",
      handle,
      fields: [
        { key: "name", value: name },
        { key: "type", value: type },
        { key: "length", value: String(length) },
        { key: "width", value: String(width) },
        { key: "height", value: String(height) },
        { key: "size_unit", value: sizeUnit || 'in' },
        { key: "weight", value: String(weight || 0) },
        { key: "weight_unit", value: weightUnit || 'oz' }
      ]
    }
  };

  const result = await shopifyGraphQL(env, query, variables);

  if (result.metaobjectCreate.userErrors?.length > 0) {
    throw new Error(result.metaobjectCreate.userErrors.map(e => e.message).join(", "));
  }

  const pkg = result.metaobjectCreate.metaobject;

  // Set as default if requested
  if (setAsDefault && pkg.id) {
    await setDefaultPackage(env, pkg.id);
  }

  return { success: true, data: pkg };
}

/**
 * Ensure the shipping_package metaobject definition exists
 */
async function ensurePackageDefinition(env) {
  const checkQuery = `
    query CheckPackageDefinition {
      metaobjectDefinitionByType(type: "shipping_package") {
        id
        name
      }
    }
  `;

  const checkResult = await shopifyGraphQL(env, checkQuery, {});

  if (checkResult.metaobjectDefinitionByType) {
    return; // Definition already exists
  }

  // Create the definition
  const createQuery = `
    mutation CreatePackageDefinition($definition: MetaobjectDefinitionCreateInput!) {
      metaobjectDefinitionCreate(definition: $definition) {
        metaobjectDefinition {
          id
          name
        }
        userErrors { field message }
      }
    }
  `;

  const createVariables = {
    definition: {
      type: "shipping_package",
      name: "Shipping Package",
      displayNameKey: "name",
      fieldDefinitions: [
        { key: "name", name: "Name", type: "single_line_text_field", required: true },
        { key: "type", name: "Type", type: "single_line_text_field", required: true },
        { key: "length", name: "Length", type: "number_decimal", required: true },
        { key: "width", name: "Width", type: "number_decimal", required: true },
        { key: "height", name: "Height", type: "number_decimal", required: true },
        { key: "size_unit", name: "Size Unit", type: "single_line_text_field", required: true },
        { key: "weight", name: "Empty Weight", type: "number_decimal" },
        { key: "weight_unit", name: "Weight Unit", type: "single_line_text_field" }
      ]
    }
  };

  const createResult = await shopifyGraphQL(env, createQuery, createVariables);

  if (createResult.metaobjectDefinitionCreate.userErrors?.length > 0) {
    console.error('[EnsurePackageDefinition] Errors:', createResult.metaobjectDefinitionCreate.userErrors);
    // Don't throw - the definition might already exist with different fields
  }
}

/**
 * Delete a custom package
 */
async function deletePackage(env, packageId) {
  const gid = packageId.startsWith("gid://") ? packageId : `gid://shopify/Metaobject/${packageId}`;

  const query = `
    mutation DeletePackage($id: ID!) {
      metaobjectDelete(id: $id) {
        deletedId
        userErrors { field message }
      }
    }
  `;

  const result = await shopifyGraphQL(env, query, { id: gid });

  if (result.metaobjectDelete.userErrors?.length > 0) {
    throw new Error(result.metaobjectDelete.userErrors.map(e => e.message).join(", "));
  }

  // If this was the default package, clear the default
  const currentDefault = await getDefaultPackageId(env);
  if (currentDefault === gid || currentDefault === packageId) {
    await clearDefaultPackage(env);
  }

  return { success: true, message: "Package deleted" };
}

/**
 * Set default package ID in shop metafield
 */
async function setDefaultPackage(env, packageId) {
  // First get the shop ID
  const shopQuery = `
    query GetShop {
      shop {
        id
      }
    }
  `;

  const shopResult = await shopifyGraphQL(env, shopQuery, {});
  const shopId = shopResult.shop?.id;

  if (!shopId) {
    throw new Error('Could not get shop ID');
  }

  const query = `
    mutation SetDefaultPackage($metafields: [MetafieldsSetInput!]!) {
      metafieldsSet(metafields: $metafields) {
        metafields {
          id
          key
          value
        }
        userErrors { field message }
      }
    }
  `;

  const variables = {
    metafields: [{
      ownerId: shopId,
      namespace: "shipping",
      key: "default_package_id",
      type: "single_line_text_field",
      value: packageId
    }]
  };

  const result = await shopifyGraphQL(env, query, variables);

  if (result.metafieldsSet.userErrors?.length > 0) {
    throw new Error(result.metafieldsSet.userErrors.map(e => e.message).join(", "));
  }

  return { success: true, message: "Default package updated" };
}

/**
 * Clear default package
 */
async function clearDefaultPackage(env) {
  const shopQuery = `
    query GetShop {
      shop {
        id
        metafield(namespace: "shipping", key: "default_package_id") {
          id
        }
      }
    }
  `;

  const shopResult = await shopifyGraphQL(env, shopQuery, {});
  const metafieldId = shopResult.shop?.metafield?.id;

  if (!metafieldId) {
    return { success: true, message: "No default package to clear" };
  }

  const deleteQuery = `
    mutation DeleteMetafield($input: MetafieldDeleteInput!) {
      metafieldDelete(input: $input) {
        deletedId
        userErrors { field message }
      }
    }
  `;

  await shopifyGraphQL(env, deleteQuery, { input: { id: metafieldId } });

  return { success: true, message: "Default package cleared" };
}

/**
 * Update product shipping info (weight, requires shipping)
 */
async function updateProductShipping(env, productId, data) {
  const gid = productId.startsWith("gid://") ? productId : `gid://shopify/Product/${productId}`;

  // Get the first variant to update its inventory item
  const getQuery = `
    query GetProductVariant($id: ID!) {
      product(id: $id) {
        variants(first: 1) {
          edges {
            node {
              id
              inventoryItem {
                id
                measurement {
                  weight {
                    value
                    unit
                  }
                }
                requiresShipping
              }
            }
          }
        }
      }
    }
  `;

  const getResult = await shopifyGraphQL(env, getQuery, { id: gid });
  const variant = getResult.product?.variants?.edges?.[0]?.node;

  if (!variant) {
    throw new Error('Product variant not found');
  }

  const inventoryItemId = variant.inventoryItem?.id;

  if (!inventoryItemId) {
    throw new Error('Inventory item not found');
  }

  // Update inventory item with shipping info
  const updateQuery = `
    mutation UpdateInventoryItem($id: ID!, $input: InventoryItemInput!) {
      inventoryItemUpdate(id: $id, input: $input) {
        inventoryItem {
          id
          requiresShipping
          measurement {
            weight {
              value
              unit
            }
          }
        }
        userErrors { field message }
      }
    }
  `;

  // Build the input
  const input = {};

  if (data.requiresShipping !== undefined) {
    input.requiresShipping = data.requiresShipping;
  }

  if (data.weight !== undefined && data.weightUnit) {
    input.measurement = {
      weight: {
        value: parseFloat(data.weight) || 0,
        unit: data.weightUnit // GRAMS, KILOGRAMS, OUNCES, POUNDS
      }
    };
  }

  const result = await shopifyGraphQL(env, updateQuery, { id: inventoryItemId, input });

  if (result.inventoryItemUpdate.userErrors?.length > 0) {
    throw new Error(result.inventoryItemUpdate.userErrors.map(e => e.message).join(", "));
  }

  return {
    success: true,
    data: result.inventoryItemUpdate.inventoryItem,
    message: "Shipping info updated"
  };
}

// ============================================
// ORDER MANAGEMENT OPERATIONS
// ============================================

/**
 * List orders with filtering options
 */
async function listOrders(env, filters = {}) {
  const { status, fulfillment, financial, query: searchQuery, limit } = filters;

  // Build query filter string
  let queryFilter = "";
  const filterParts = [];

  if (status) filterParts.push(`status:${status}`);
  if (fulfillment) filterParts.push(`fulfillment_status:${fulfillment}`);
  if (financial) filterParts.push(`financial_status:${financial}`);
  if (searchQuery) filterParts.push(searchQuery);

  if (filterParts.length > 0) {
    queryFilter = filterParts.join(" ");
  }

  const gqlQuery = `
    query ListOrders($first: Int!, $query: String) {
      orders(first: $first, query: $query, sortKey: CREATED_AT, reverse: true) {
        edges {
          node {
            id
            name
            createdAt
            updatedAt
            closedAt
            cancelledAt
            displayFinancialStatus
            displayFulfillmentStatus
            confirmed
            test
            email
            phone
            note
            tags
            currencyCode
            totalPriceSet {
              shopMoney { amount currencyCode }
            }
            subtotalPriceSet {
              shopMoney { amount currencyCode }
            }
            totalShippingPriceSet {
              shopMoney { amount currencyCode }
            }
            totalTaxSet {
              shopMoney { amount currencyCode }
            }
            totalDiscountsSet {
              shopMoney { amount currencyCode }
            }
            totalRefundedSet {
              shopMoney { amount currencyCode }
            }
            customer {
              id
              displayName
              email
              phone
              tags
            }
            shippingAddress {
              name
              address1
              address2
              city
              province
              provinceCode
              country
              countryCodeV2
              zip
              phone
            }
            billingAddress {
              name
              address1
              address2
              city
              province
              provinceCode
              country
              countryCodeV2
              zip
              phone
            }
            lineItems(first: 50) {
              edges {
                node {
                  id
                  name
                  title
                  quantity
                  sku
                  variantTitle
                  vendor
                  requiresShipping
                  fulfillableQuantity
                  fulfillmentStatus
                  originalUnitPriceSet {
                    shopMoney { amount currencyCode }
                  }
                  discountedUnitPriceSet {
                    shopMoney { amount currencyCode }
                  }
                  image {
                    url(transform: { maxWidth: 100, maxHeight: 100 })
                  }
                  variant {
                    id
                    sku
                    image {
                      url(transform: { maxWidth: 100, maxHeight: 100 })
                    }
                  }
                  product {
                    id
                    handle
                  }
                }
              }
            }
            fulfillments(first: 10) {
              id
              status
              displayStatus
              createdAt
              updatedAt
              trackingInfo {
                company
                number
                url
              }
            }
            transactions(first: 10) {
              id
              kind
              status
              gateway
              amountSet {
                shopMoney { amount currencyCode }
              }
              createdAt
            }
          }
        }
        pageInfo {
          hasNextPage
          hasPreviousPage
        }
      }
    }
  `;

  const result = await shopifyGraphQL(env, gqlQuery, {
    first: limit || 50,
    query: queryFilter || null
  });

  const orders = result.orders.edges.map(edge => {
    const order = edge.node;
    return {
      id: order.id,
      name: order.name,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      closedAt: order.closedAt,
      cancelledAt: order.cancelledAt,
      financialStatus: order.displayFinancialStatus,
      fulfillmentStatus: order.displayFulfillmentStatus,
      confirmed: order.confirmed,
      test: order.test,
      email: order.email,
      phone: order.phone,
      note: order.note,
      tags: order.tags,
      currency: order.currencyCode,
      totalPrice: order.totalPriceSet?.shopMoney?.amount,
      subtotalPrice: order.subtotalPriceSet?.shopMoney?.amount,
      totalShipping: order.totalShippingPriceSet?.shopMoney?.amount,
      totalTax: order.totalTaxSet?.shopMoney?.amount,
      totalDiscounts: order.totalDiscountsSet?.shopMoney?.amount,
      totalRefunded: order.totalRefundedSet?.shopMoney?.amount,
      customer: order.customer,
      shippingAddress: order.shippingAddress,
      billingAddress: order.billingAddress,
      lineItems: order.lineItems.edges.map(e => e.node),
      fulfillments: order.fulfillments,
      transactions: order.transactions
    };
  });

  return {
    success: true,
    orders,
    pageInfo: result.orders.pageInfo
  };
}

/**
 * Get single order with full details
 */
async function getOrder(env, orderId) {
  const gid = orderId.startsWith("gid://") ? orderId : `gid://shopify/Order/${orderId}`;

  const query = `
    query GetOrder($id: ID!) {
      order(id: $id) {
        id
        name
        createdAt
        updatedAt
        processedAt
        closedAt
        cancelledAt
        cancelReason
        displayFinancialStatus
        displayFulfillmentStatus
        confirmed
        test
        email
        phone
        note
        tags
        currencyCode
        poNumber
        sourceIdentifier
        sourceName
        
        totalPriceSet { shopMoney { amount currencyCode } }
        subtotalPriceSet { shopMoney { amount currencyCode } }
        totalShippingPriceSet { shopMoney { amount currencyCode } }
        totalTaxSet { shopMoney { amount currencyCode } }
        totalDiscountsSet { shopMoney { amount currencyCode } }
        totalRefundedSet { shopMoney { amount currencyCode } }
        totalOutstandingSet { shopMoney { amount currencyCode } }
        currentTotalPriceSet { shopMoney { amount currencyCode } }
        netPaymentSet { shopMoney { amount currencyCode } }
        
        customer {
          id
          displayName
          firstName
          lastName
          email
          phone
          tags
          numberOfOrders
          amountSpent {
            amount
            currencyCode
          }
          defaultAddress {
            address1
            address2
            city
            province
            country
            zip
          }
        }
        
        shippingAddress {
          name
          firstName
          lastName
          address1
          address2
          city
          province
          provinceCode
          country
          countryCodeV2
          zip
          phone
          company
          validationResultSummary
          coordinatesValidated
          latitude
          longitude
        }
        
        billingAddress {
          name
          firstName
          lastName
          address1
          address2
          city
          province
          provinceCode
          country
          countryCodeV2
          zip
          phone
          company
        }
        
        shippingLine {
          title
          code
          source
          originalPriceSet { shopMoney { amount currencyCode } }
          discountedPriceSet { shopMoney { amount currencyCode } }
          carrierIdentifier
          requestedFulfillmentService { handle }
        }
        
        lineItems(first: 100) {
          edges {
            node {
              id
              name
              title
              quantity
              sku
              variantTitle
              vendor
              requiresShipping
              fulfillableQuantity
              fulfillmentStatus
              taxable
              originalUnitPriceSet { shopMoney { amount currencyCode } }
              discountedUnitPriceSet { shopMoney { amount currencyCode } }
              originalTotalSet { shopMoney { amount currencyCode } }
              discountedTotalSet { shopMoney { amount currencyCode } }
              totalDiscountSet { shopMoney { amount currencyCode } }
              image { url(transform: { maxWidth: 200, maxHeight: 200 }) altText }
              variant {
                id
                sku
                title
                inventoryQuantity
                image { url(transform: { maxWidth: 200, maxHeight: 200 }) }
              }
              product {
                id
                handle
                title
              }
              customAttributes {
                key
                value
              }
              duties {
                id
                harmonizedSystemCode
                price { shopMoney { amount currencyCode } }
              }
              taxLines {
                title
                rate
                priceSet { shopMoney { amount currencyCode } }
              }
              discountAllocations {
                allocatedAmountSet { shopMoney { amount currencyCode } }
                discountApplication {
                  ... on DiscountCodeApplication {
                    code
                  }
                  ... on AutomaticDiscountApplication {
                    title
                  }
                  ... on ManualDiscountApplication {
                    title
                  }
                }
              }
            }
          }
        }
        
        fulfillmentOrders(first: 20) {
          edges {
            node {
              id
              status
              requestStatus
              createdAt
              updatedAt
              fulfillAt
              assignedLocation {
                location {
                  id
                }
                name
                address1
                city
                countryCode
                zip
              }
              lineItems(first: 50) {
                edges {
                  node {
                    id
                    totalQuantity
                    remainingQuantity
                    lineItem {
                      id
                      name
                      sku
                    }
                  }
                }
              }
              fulfillments(first: 10) {
                edges {
                  node {
                    id
                    status
                    displayStatus
                    createdAt
                    trackingInfo {
                      company
                      number
                      url
                    }
                  }
                }
              }
            }
          }
        }
        
        fulfillments(first: 20) {
          id
          name
          status
          displayStatus
          createdAt
          updatedAt
          deliveredAt
          estimatedDeliveryAt
          inTransitAt
          trackingInfo {
            company
            number
            url
          }
          fulfillmentLineItems(first: 50) {
            edges {
              node {
                id
                quantity
                lineItem {
                  id
                  name
                  sku
                }
              }
            }
          }
          originAddress {
            address1
            address2
            city
            countryCode
            zip
          }
        }
        
        transactions(first: 20) {
          id
          kind
          status
          gateway
          test
          amountSet { shopMoney { amount currencyCode } }
          createdAt
          processedAt
          formattedGateway
        }
        
        refunds(first: 20) {
          id
          createdAt
          note
          totalRefundedSet { shopMoney { amount currencyCode } }
          refundLineItems(first: 50) {
            edges {
              node {
                lineItem { id name sku }
                quantity
                priceSet { shopMoney { amount currencyCode } }
                subtotalSet { shopMoney { amount currencyCode } }
                totalTaxSet { shopMoney { amount currencyCode } }
              }
            }
          }
        }
        
        discountApplications(first: 20) {
          edges {
            node {
              allocationMethod
              targetSelection
              targetType
              value {
                ... on MoneyV2 { amount currencyCode }
                ... on PricingPercentageValue { percentage }
              }
              ... on DiscountCodeApplication { code }
              ... on AutomaticDiscountApplication { title }
              ... on ManualDiscountApplication { title description }
            }
          }
        }
        
        risks(first: 10) {
          level
          message
          display
        }
        
        events(first: 50, sortKey: CREATED_AT, reverse: true) {
          edges {
            node {
              id
              createdAt
              message
            }
          }
        }
        
        metafields(first: 20) {
          edges {
            node {
              id
              namespace
              key
              value
              type
            }
          }
        }
      }
    }
  `;

  const result = await shopifyGraphQL(env, query, { id: gid });

  if (!result.order) {
    throw new Error("Order not found");
  }

  const order = result.order;

  return {
    success: true,
    order: {
      ...order,
      lineItems: order.lineItems.edges.map(e => e.node),
      fulfillmentOrders: order.fulfillmentOrders.edges.map(e => e.node),
      discountApplications: order.discountApplications.edges.map(e => e.node),
      events: order.events.edges.map(e => e.node),
      metafields: order.metafields.edges.map(e => e.node),
      customer: order.customer ? {
        ...order.customer,
        ordersCount: order.customer.numberOfOrders,
        totalSpent: order.customer.amountSpent
      } : null
    }
  };
}

/**
 * Update order (notes, tags, shipping address)
 */
async function updateOrder(env, orderId, data) {
  const gid = orderId.startsWith("gid://") ? orderId : `gid://shopify/Order/${orderId}`;

  const input = {};

  if (data.note !== undefined) input.note = data.note;
  if (data.tags !== undefined) input.tags = Array.isArray(data.tags) ? data.tags : data.tags.split(",").map(t => t.trim());
  if (data.email !== undefined) input.email = data.email;
  if (data.phone !== undefined) input.phone = data.phone;
  if (data.shippingAddress) input.shippingAddress = data.shippingAddress;
  if (data.customAttributes) input.customAttributes = data.customAttributes;
  if (data.poNumber !== undefined) input.poNumber = data.poNumber;

  const query = `
    mutation UpdateOrder($input: OrderInput!) {
      orderUpdate(input: $input) {
        order {
          id
          name
          note
          tags
          email
          phone
          shippingAddress {
            name
            address1
            address2
            city
            province
            country
            zip
          }
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  const result = await shopifyGraphQL(env, query, { input: { id: gid, ...input } });

  if (result.orderUpdate.userErrors?.length > 0) {
    throw new Error(result.orderUpdate.userErrors.map(e => e.message).join(", "));
  }

  return { success: true, order: result.orderUpdate.order };
}

/**
 * Cancel order
 */
async function cancelOrder(env, orderId, data = {}) {
  const gid = orderId.startsWith("gid://") ? orderId : `gid://shopify/Order/${orderId}`;

  const query = `
    mutation CancelOrder($orderId: ID!, $reason: OrderCancelReason!, $refund: Boolean!, $restock: Boolean!, $notifyCustomer: Boolean) {
      orderCancel(orderId: $orderId, reason: $reason, refund: $refund, restock: $restock, notifyCustomer: $notifyCustomer) {
        job { id }
        orderCancelUserErrors {
          field
          message
          code
        }
      }
    }
  `;

  const result = await shopifyGraphQL(env, query, {
    orderId: gid,
    reason: data.reason || "OTHER",
    refund: data.refund !== false,
    restock: data.restock !== false,
    notifyCustomer: data.notifyCustomer !== false
  });

  if (result.orderCancel.orderCancelUserErrors?.length > 0) {
    throw new Error(result.orderCancel.orderCancelUserErrors.map(e => e.message).join(", "));
  }

  return { success: true, jobId: result.orderCancel.job?.id, message: "Order cancellation initiated" };
}

/**
 * Close order
 */
async function closeOrder(env, orderId) {
  const gid = orderId.startsWith("gid://") ? orderId : `gid://shopify/Order/${orderId}`;

  const query = `
    mutation CloseOrder($input: OrderCloseInput!) {
      orderClose(input: $input) {
        order {
          id
          name
          closedAt
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  const result = await shopifyGraphQL(env, query, { input: { id: gid } });

  if (result.orderClose.userErrors?.length > 0) {
    throw new Error(result.orderClose.userErrors.map(e => e.message).join(", "));
  }

  return { success: true, order: result.orderClose.order };
}

/**
 * Reopen order
 */
async function reopenOrder(env, orderId) {
  const gid = orderId.startsWith("gid://") ? orderId : `gid://shopify/Order/${orderId}`;

  const query = `
    mutation OpenOrder($input: OrderOpenInput!) {
      orderOpen(input: $input) {
        order {
          id
          name
          closedAt
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  const result = await shopifyGraphQL(env, query, { input: { id: gid } });

  if (result.orderOpen.userErrors?.length > 0) {
    throw new Error(result.orderOpen.userErrors.map(e => e.message).join(", "));
  }

  return { success: true, order: result.orderOpen.order };
}

/**
 * Get fulfillment orders for an order
 */
async function getFulfillmentOrders(env, orderId) {
  const gid = orderId.startsWith("gid://") ? orderId : `gid://shopify/Order/${orderId}`;

  const query = `
    query GetFulfillmentOrders($id: ID!) {
      order(id: $id) {
        id
        name
        fulfillmentOrders(first: 20) {
          edges {
            node {
              id
              status
              requestStatus
              createdAt
              fulfillAt
              assignedLocation {
                location {
                  id
                }
                name
                address1
                city
                countryCode
                zip
                phone
              }
              destination {
                firstName
                lastName
                address1
                address2
                city
                province
                countryCode
                zip
                phone
              }
              lineItems(first: 50) {
                edges {
                  node {
                    id
                    totalQuantity
                    remainingQuantity
                    lineItem {
                      id
                      name
                      title
                      sku
                      variantTitle
                      image { url(transform: { maxWidth: 100, maxHeight: 100 }) }
                    }
                  }
                }
              }
              supportedActions {
                action
                externalUrl
              }
            }
          }
        }
      }
    }
  `;

  const result = await shopifyGraphQL(env, query, { id: gid });

  if (!result.order) {
    throw new Error("Order not found");
  }

  return {
    success: true,
    fulfillmentOrders: result.order.fulfillmentOrders.edges.map(e => ({
      ...e.node,
      lineItems: e.node.lineItems.edges.map(li => li.node)
    }))
  };
}

/**
 * Create fulfillment
 */
async function createFulfillment(env, data) {
  const query = `
    mutation CreateFulfillment($fulfillment: FulfillmentInput!) {
      fulfillmentCreate(fulfillment: $fulfillment) {
        fulfillment {
          id
          name
          status
          displayStatus
          createdAt
          trackingInfo {
            company
            number
            url
          }
          fulfillmentLineItems(first: 50) {
            edges {
              node {
                id
                quantity
                lineItem {
                  id
                  name
                  sku
                }
              }
            }
          }
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  const fulfillmentInput = {
    notifyCustomer: data.notifyCustomer !== false,
    lineItemsByFulfillmentOrder: data.lineItemsByFulfillmentOrder || [{
      fulfillmentOrderId: data.fulfillmentOrderId,
      fulfillmentOrderLineItems: data.fulfillmentOrderLineItems
    }]
  };

  if (data.trackingInfo) {
    fulfillmentInput.trackingInfo = {
      company: data.trackingInfo.company,
      number: data.trackingInfo.number,
      url: data.trackingInfo.url,
      numbers: data.trackingInfo.numbers,
      urls: data.trackingInfo.urls
    };
  }

  if (data.originAddress) {
    fulfillmentInput.originAddress = data.originAddress;
  }

  const result = await shopifyGraphQL(env, query, { fulfillment: fulfillmentInput });

  if (result.fulfillmentCreate.userErrors?.length > 0) {
    throw new Error(result.fulfillmentCreate.userErrors.map(e => e.message).join(", "));
  }

  return {
    success: true,
    fulfillment: {
      ...result.fulfillmentCreate.fulfillment,
      fulfillmentLineItems: result.fulfillmentCreate.fulfillment.fulfillmentLineItems.edges.map(e => e.node)
    }
  };
}

/**
 * Update fulfillment tracking
 */
async function updateFulfillmentTracking(env, fulfillmentId, data) {
  const gid = fulfillmentId.startsWith("gid://") ? fulfillmentId : `gid://shopify/Fulfillment/${fulfillmentId}`;

  const query = `
    mutation UpdateTracking($fulfillmentId: ID!, $trackingInfoInput: FulfillmentTrackingInput!, $notifyCustomer: Boolean) {
      fulfillmentTrackingInfoUpdate(fulfillmentId: $fulfillmentId, trackingInfoInput: $trackingInfoInput, notifyCustomer: $notifyCustomer) {
        fulfillment {
          id
          status
          trackingInfo {
            company
            number
            url
          }
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  // Handle both direct data and nested trackingInfo format
  const trackingData = data.trackingInfo || data;

  const result = await shopifyGraphQL(env, query, {
    fulfillmentId: gid,
    trackingInfoInput: {
      company: trackingData.company,
      number: trackingData.number,
      url: trackingData.url,
      numbers: trackingData.numbers,
      urls: trackingData.urls
    },
    notifyCustomer: data.notifyCustomer !== false
  });

  if (result.fulfillmentTrackingInfoUpdate.userErrors?.length > 0) {
    throw new Error(result.fulfillmentTrackingInfoUpdate.userErrors.map(e => e.message).join(", "));
  }

  return { success: true, fulfillment: result.fulfillmentTrackingInfoUpdate.fulfillment };
}

/**
 * Move fulfillment order to in progress (release hold if on hold)
 */
async function moveFulfillmentOrderToInProgress(env, fulfillmentOrderId) {
  const gid = fulfillmentOrderId.startsWith("gid://") ? fulfillmentOrderId : `gid://shopify/FulfillmentOrder/${fulfillmentOrderId}`;

  // First try to release hold (if the order is on hold)
  const releaseHoldQuery = `
    mutation ReleaseFulfillmentOrderHold($id: ID!) {
      fulfillmentOrderReleaseHold(id: $id) {
        fulfillmentOrder {
          id
          status
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  try {
    const releaseResult = await shopifyGraphQL(env, releaseHoldQuery, { id: gid });

    if (releaseResult.fulfillmentOrderReleaseHold?.fulfillmentOrder) {
      return {
        success: true,
        fulfillmentOrder: releaseResult.fulfillmentOrderReleaseHold.fulfillmentOrder,
        message: "Hold released - order is now in progress"
      };
    }

    // If release hold didn't work (maybe not on hold), try to open it
    const openQuery = `
      mutation OpenFulfillmentOrder($id: ID!) {
        fulfillmentOrderOpen(id: $id) {
          fulfillmentOrder {
            id
            status
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

    const openResult = await shopifyGraphQL(env, openQuery, { id: gid });

    if (openResult.fulfillmentOrderOpen?.fulfillmentOrder) {
      return {
        success: true,
        fulfillmentOrder: openResult.fulfillmentOrderOpen.fulfillmentOrder,
        message: "Order reopened"
      };
    }

    // If neither worked, the order is likely already open/in progress
    return { success: true, message: "Fulfillment order is ready for fulfillment" };
  } catch (e) {
    return { success: true, message: "Fulfillment order status updated" };
  }
}

/**
 * Hold fulfillment order
 */
async function holdFulfillmentOrder(env, fulfillmentOrderId, data) {
  const gid = fulfillmentOrderId.startsWith("gid://") ? fulfillmentOrderId : `gid://shopify/FulfillmentOrder/${fulfillmentOrderId}`;

  const query = `
    mutation HoldFulfillmentOrder($id: ID!, $reason: FulfillmentHoldReason!, $reasonNotes: String) {
      fulfillmentOrderHold(id: $id, fulfillmentHold: { reason: $reason, reasonNotes: $reasonNotes }) {
        fulfillmentOrder {
          id
          status
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  const result = await shopifyGraphQL(env, query, {
    id: gid,
    reason: data.reason || "OTHER",
    reasonNotes: data.reasonNotes || "Held from admin dashboard"
  });

  if (result.fulfillmentOrderHold?.userErrors?.length > 0) {
    throw new Error(result.fulfillmentOrderHold.userErrors.map(e => e.message).join(", "));
  }

  return { success: true, fulfillmentOrder: result.fulfillmentOrderHold?.fulfillmentOrder };
}

/**
 * Release fulfillment order hold
 */
async function releaseFulfillmentOrderHold(env, fulfillmentOrderId) {
  const gid = fulfillmentOrderId.startsWith("gid://") ? fulfillmentOrderId : `gid://shopify/FulfillmentOrder/${fulfillmentOrderId}`;

  const query = `
    mutation ReleaseFulfillmentOrderHold($id: ID!) {
      fulfillmentOrderReleaseHold(id: $id) {
        fulfillmentOrder {
          id
          status
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  const result = await shopifyGraphQL(env, query, { id: gid });

  if (result.fulfillmentOrderReleaseHold?.userErrors?.length > 0) {
    throw new Error(result.fulfillmentOrderReleaseHold.userErrors.map(e => e.message).join(", "));
  }

  return { success: true, fulfillmentOrder: result.fulfillmentOrderReleaseHold?.fulfillmentOrder };
}

/**
 * Cancel fulfillment
 */
async function cancelFulfillment(env, fulfillmentId) {
  const gid = fulfillmentId.startsWith("gid://") ? fulfillmentId : `gid://shopify/Fulfillment/${fulfillmentId}`;

  const query = `
    mutation CancelFulfillment($id: ID!) {
      fulfillmentCancel(id: $id) {
        fulfillment {
          id
          status
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  const result = await shopifyGraphQL(env, query, { id: gid });

  if (result.fulfillmentCancel.userErrors?.length > 0) {
    throw new Error(result.fulfillmentCancel.userErrors.map(e => e.message).join(", "));
  }

  return { success: true, fulfillment: result.fulfillmentCancel.fulfillment };
}

/**
 * Add order note (creates a comment event)
 */
async function addOrderNote(env, orderId, data) {
  const gid = orderId.startsWith("gid://") ? orderId : `gid://shopify/Order/${orderId}`;

  // First update the order note field
  if (data.note) {
    const updateQuery = `
      mutation UpdateOrderNote($input: OrderInput!) {
        orderUpdate(input: $input) {
          order {
            id
            note
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

    const result = await shopifyGraphQL(env, updateQuery, {
      input: { id: gid, note: data.note }
    });

    if (result.orderUpdate.userErrors?.length > 0) {
      throw new Error(result.orderUpdate.userErrors.map(e => e.message).join(", "));
    }

    return { success: true, order: result.orderUpdate.order };
  }

  return { success: true, message: "Order note updated locally (simulated)" };
}

// ============================================
// SHOP PROFILE OPERATIONS
// ============================================

/**
 * Get shop profile (settings, logo, social links)
 */
async function getShopProfile(env) {
  // 1. Get Shop Info & Metafield Profile
  const shopQuery = `
    query GetShopProfile {
      shop {
        id
        name
        email
        primaryDomain { url }
        metafield(namespace: "custom", key: "shop_profile") {
          value
        }
      }
    }
  `;

  const shopResult = await shopifyGraphQL(env, shopQuery, {});
  const shop = shopResult.shop;

  // Default values from shop
  let profile = {
    name: shop.name,
    email: shop.email,
    logo: "",
    social_twitter: "",
    social_instagram: "",
    social_facebook: "",
    social_youtube: ""
  };

  // Override with Metafield if exists (except name - always use real Shopify name)
  if (shop.metafield?.value) {
    try {
      const savedProfile = JSON.parse(shop.metafield.value);
      profile = { ...profile, ...savedProfile };
    } catch (e) {
      console.error("Failed to parse shop profile metafield", e);
    }
  }

  // Always use the real Shopify shop name and email (cannot be changed via API)
  profile.name = shop.name;
  profile.email = shop.email;

  return profile;
}

/**
 * Update shop profile
 */
async function updateShopProfile(env, data) {
  const shopQuery = `
    query GetShop {
      shop {
        id
      }
    }
  `;
  const shopResult = await shopifyGraphQL(env, shopQuery, {});
  const shopId = shopResult.shop.id;

  // 1. Save to Shop Metafield (Source of Truth for Dashboard)
  const metaQuery = `
    mutation SaveShopProfile($metafields: [MetafieldsSetInput!]!) {
      metafieldsSet(metafields: $metafields) {
        metafields {
          id
          value
        }
        userErrors { field message }
      }
    }
  `;

  const profileData = {
    name: data.name,
    email: data.email,
    logo: data.logo, // URL or GID
    social_twitter: data.social_twitter,
    social_instagram: data.social_instagram,
    social_facebook: data.social_facebook,
    social_youtube: data.social_youtube
  };

  await shopifyGraphQL(env, metaQuery, {
    metafields: [{
      ownerId: shopId,
      namespace: "custom",
      key: "shop_profile",
      type: "json",
      value: JSON.stringify(profileData)
    }]
  });

  // 2. Ensure Metafield Definition Exists (for Storefront visibility)
  try {
    await ensureShopProfileDefinition(env);
  } catch (e) {
    console.error("Failed to ensure metafield definition:", e);
  }

  // 3. Sync to Theme Settings (if logo/socials provided)
  try {
    await updateMainThemeSettings(env, data);
  } catch (e) {
    console.error("Failed to sync to theme settings:", e);
  }

  return { success: true, profile: profileData };
}

/**
 * Helper: Ensure Metafield Definition exists
 * This makes the custom.shop_profile visible to Liquid Storefront API
 */
async function ensureShopProfileDefinition(env) {
  const query = `
    mutation CreateShopProfileDef {
      metafieldDefinitionCreate(definition: {
        name: "Shop Profile",
        namespace: "custom",
        key: "shop_profile",
        type: "json",
        ownerType: SHOP,
        access: {
          storefront: PUBLIC_READ
        }
      }) {
        createdDefinition { id }
        userErrors { field message }
      }
    }
  `;

  // Note: This might fail if definition already exists (returns unique error) or permissions missing.
  // We ignore errors as it's a "best effort" auto-fix.
  await shopifyGraphQL(env, query, {});
}

/**
 * Upload shop logo using Shopify staged uploads
 */
async function uploadShopLogo(env, formData) {
  const file = formData.get('file');
  if (!file) {
    throw new Error('No file provided');
  }

  const filename = file.name || 'logo.png';
  const contentType = file.type || 'image/png';
  const fileSize = file.size;

  // 1. Create staged upload target
  const stagedUploadQuery = `
    mutation CreateStagedUpload($input: [StagedUploadInput!]!) {
      stagedUploadsCreate(input: $input) {
        stagedTargets {
          url
          resourceUrl
          parameters {
            name
            value
          }
        }
        userErrors { field message }
      }
    }
  `;

  const stagedResult = await shopifyGraphQL(env, stagedUploadQuery, {
    input: [{
      filename: filename,
      mimeType: contentType,
      resource: "FILE",
      fileSize: String(fileSize),
      httpMethod: "POST"
    }]
  });

  if (stagedResult.stagedUploadsCreate.userErrors?.length > 0) {
    throw new Error(stagedResult.stagedUploadsCreate.userErrors.map(e => e.message).join(", "));
  }

  const target = stagedResult.stagedUploadsCreate.stagedTargets[0];
  if (!target) {
    throw new Error('Failed to create staged upload');
  }

  // 2. Upload file to staged URL
  const uploadForm = new FormData();
  for (const param of target.parameters) {
    uploadForm.append(param.name, param.value);
  }
  uploadForm.append('file', file);

  const uploadRes = await fetch(target.url, {
    method: 'POST',
    body: uploadForm
  });

  if (!uploadRes.ok) {
    throw new Error('Failed to upload file to staged URL');
  }

  // 3. Create file in Shopify Files
  const createFileQuery = `
    mutation CreateFile($files: [FileCreateInput!]!) {
      fileCreate(files: $files) {
        files {
          id
          alt
          createdAt
          ... on MediaImage {
            image {
              url
            }
          }
          ... on GenericFile {
            url
          }
        }
        userErrors { field message }
      }
    }
  `;

  const fileResult = await shopifyGraphQL(env, createFileQuery, {
    files: [{
      alt: "Shop Logo",
      contentType: "IMAGE",
      originalSource: target.resourceUrl
    }]
  });

  if (fileResult.fileCreate.userErrors?.length > 0) {
    throw new Error(fileResult.fileCreate.userErrors.map(e => e.message).join(", "));
  }

  const createdFile = fileResult.fileCreate.files[0];

  // Get the final CDN URL - poll until file is processed (up to 5 seconds)
  let logoUrl = null;
  let attempts = 0;
  const maxAttempts = 5;

  while (!logoUrl && attempts < maxAttempts) {
    await new Promise(r => setTimeout(r, 1000));
    attempts++;

    const fileQuery = `
      query GetFile($id: ID!) {
        node(id: $id) {
          ... on MediaImage {
            image {
              url
            }
          }
          ... on GenericFile {
            url
          }
        }
      }
    `;

    const fileInfo = await shopifyGraphQL(env, fileQuery, { id: createdFile.id });
    const fetchedUrl = fileInfo.node?.image?.url || fileInfo.node?.url;

    // Only accept Shopify CDN URLs, not staged URLs
    if (fetchedUrl && fetchedUrl.includes('cdn.shopify.com')) {
      logoUrl = fetchedUrl;
      console.log('Got final CDN URL:', logoUrl);
    } else {
      console.log('File still processing, attempt', attempts, 'URL:', fetchedUrl);
    }
  }

  if (!logoUrl) {
    logoUrl = target.resourceUrl;
    console.log('Using staged URL as fallback:', logoUrl);
  }

  // 4. Try to update theme settings with the CDN URL
  try {
    await updateThemeLogo(env, logoUrl, createdFile.id);
  } catch (e) {
    console.error('Failed to update theme logo:', e);
  }

  return {
    success: true,
    url: logoUrl,
    fileId: createdFile.id
  };
}

/**
 * Helper: Update theme logo setting by uploading as theme asset
 */
async function updateThemeLogo(env, logoUrl, fileId) {
  try {
    // 1. Get Main Theme ID
    const themesRes = await fetch(`https://${env.SHOPIFY_DOMAIN}/admin/api/2024-01/themes.json?role=main`, {
      headers: { 'X-Shopify-Access-Token': env.SHOPIFY_ACCESS_TOKEN }
    });

    if (!themesRes.ok) {
      console.error('Failed to get themes:', await themesRes.text());
      return;
    }

    const themes = await themesRes.json();
    const mainTheme = themes.themes?.[0];
    if (!mainTheme) {
      console.error('No main theme found');
      return;
    }

    // 2. Download the image from CDN
    const imageRes = await fetch(logoUrl);
    if (!imageRes.ok) {
      console.error('Failed to download image:', await imageRes.text());
      return;
    }

    const imageBuffer = await imageRes.arrayBuffer();
    const base64Image = btoa(String.fromCharCode(...new Uint8Array(imageBuffer)));

    // 3. Upload as theme asset
    const assetKey = 'assets/custom-logo.png';
    console.log('Uploading image as theme asset:', assetKey);

    const uploadAssetRes = await fetch(`https://${env.SHOPIFY_DOMAIN}/admin/api/2024-01/themes/${mainTheme.id}/assets.json`, {
      method: 'PUT',
      headers: {
        'X-Shopify-Access-Token': env.SHOPIFY_ACCESS_TOKEN,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        asset: {
          key: assetKey,
          attachment: base64Image
        }
      })
    });

    if (!uploadAssetRes.ok) {
      console.error('Failed to upload theme asset:', await uploadAssetRes.text());
      return;
    }

    const uploadedAsset = await uploadAssetRes.json();
    console.log('Theme asset uploaded:', uploadedAsset.asset?.public_url);

    // 4. Get current settings
    const assetRes = await fetch(`https://${env.SHOPIFY_DOMAIN}/admin/api/2024-01/themes/${mainTheme.id}/assets.json?asset[key]=config/settings_data.json`, {
      headers: { 'X-Shopify-Access-Token': env.SHOPIFY_ACCESS_TOKEN }
    });

    if (!assetRes.ok) {
      console.error('Failed to get settings_data:', await assetRes.text());
      return;
    }

    const assetData = await assetRes.json();
    const settingsData = JSON.parse(assetData.asset.value);
    const current = settingsData.current || {};

    // 5. Set the logo using shopify://shop_images/ format with uploaded asset
    // Theme assets use format: shopify://shop_images/custom-logo.png
    const imageRef = 'shopify://shop_images/custom-logo.png';
    console.log('Setting logo with reference:', imageRef);

    current.logo = imageRef;
    current.logo_inverse = imageRef;
    current.favicon = imageRef;

    settingsData.current = current;

    const updateRes = await fetch(`https://${env.SHOPIFY_DOMAIN}/admin/api/2024-01/themes/${mainTheme.id}/assets.json`, {
      method: 'PUT',
      headers: {
        'X-Shopify-Access-Token': env.SHOPIFY_ACCESS_TOKEN,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        asset: {
          key: 'config/settings_data.json',
          value: JSON.stringify(settingsData)
        }
      })
    });

    if (!updateRes.ok) {
      console.error('Theme update failed:', await updateRes.text());
    } else {
      console.log('Theme settings updated successfully');
    }
  } catch (e) {
    console.error('updateThemeLogo error:', e);
  }
}

/**
 * Helper: Update Main Theme Settings
 */
async function updateMainThemeSettings(env, data) {
  // 1. Get Main Theme ID
  const themesRes = await fetch(`https://${env.SHOPIFY_DOMAIN}/admin/api/2024-01/themes.json?role=main`, {
    headers: { 'X-Shopify-Access-Token': env.SHOPIFY_ACCESS_TOKEN }
  });

  if (!themesRes.ok) return;

  const themes = await themesRes.json();
  const mainTheme = themes.themes?.[0];
  if (!mainTheme) return;

  // 2. Get current settings
  const assetRes = await fetch(`https://${env.SHOPIFY_DOMAIN}/admin/api/2024-01/themes/${mainTheme.id}/assets.json?asset[key]=config/settings_data.json`, {
    headers: { 'X-Shopify-Access-Token': env.SHOPIFY_ACCESS_TOKEN }
  });

  if (!assetRes.ok) return;

  const assetData = await assetRes.json();
  const settingsData = JSON.parse(assetData.asset.value);
  const current = settingsData.current || {};

  let changed = false;

  // Update Socials (Standard Keys)
  if (data.social_twitter !== undefined) { current.social_twitter_link = data.social_twitter; changed = true; }
  if (data.social_instagram !== undefined) { current.social_instagram_link = data.social_instagram; changed = true; }
  if (data.social_facebook !== undefined) { current.social_facebook_link = data.social_facebook; changed = true; }
  if (data.social_youtube !== undefined) { current.social_youtube_link = data.social_youtube; changed = true; }

  // Note: Logo update skipped for now as it requires complex GID -> ID mapping for image_picker

  if (changed) {
    settingsData.current = current;
    await fetch(`https://${env.SHOPIFY_DOMAIN}/admin/api/2024-01/themes/${mainTheme.id}/assets.json`, {
      method: 'PUT',
      headers: {
        'X-Shopify-Access-Token': env.SHOPIFY_ACCESS_TOKEN,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        asset: {
          key: 'config/settings_data.json',
          value: JSON.stringify(settingsData)
        }
      })
    });
  }
}



/**
 * Mark order as paid
 */
async function markOrderAsPaid(env, orderId) {
  const gid = orderId.startsWith("gid://") ? orderId : `gid://shopify/Order/${orderId}`;

  const query = `
    mutation MarkAsPaid($input: OrderMarkAsPaidInput!) {
      orderMarkAsPaid(input: $input) {
        order {
          id
          name
          displayFinancialStatus
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  const result = await shopifyGraphQL(env, query, { input: { id: gid } });

  if (result.orderMarkAsPaid.userErrors?.length > 0) {
    throw new Error(result.orderMarkAsPaid.userErrors.map(e => e.message).join(", "));
  }

  return { success: true, order: result.orderMarkAsPaid.order };
}

/**
 * Calculate refund (Stage 1) - Uses REST API for calculation
 * Returns suggested refund amounts including taxes
 */
async function calculateRefund(env, orderId, data) {
  const numericOrderId = orderId.startsWith("gid://") ? orderId.split("/").pop() : orderId;

  // Build refund line items for calculation - REST API needs numeric IDs
  const refundLineItems = (data.refundLineItems || []).map(item => {
    // Extract numeric ID from GID format (gid://shopify/LineItem/123456)
    let lineItemId = item.lineItemId;
    if (lineItemId.startsWith("gid://")) {
      lineItemId = lineItemId.split("/").pop();
    }
    // Ensure it's a number for REST API
    const numericLineItemId = parseInt(lineItemId);

    return {
      line_item_id: numericLineItemId,
      quantity: parseInt(item.quantity),
      restock_type: item.restockType || (data.restock ? "return" : "no_restock")
    };
  });

  console.log('[Calculate Refund] Order:', numericOrderId, 'Line Items:', JSON.stringify(refundLineItems));

  // Build shipping refund
  const shipping = data.shipping || {};

  const calculatePayload = {
    refund: {
      currency: data.currency || "USD",
      shipping: shipping.fullRefund ? { full_refund: true } : { amount: shipping.amount || 0 },
      refund_line_items: refundLineItems
    }
  };

  // Use REST API for calculation
  const response = await fetch(
    `https://${env.SHOPIFY_DOMAIN}/admin/api/2024-07/orders/${numericOrderId}/refunds/calculate.json`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": env.SHOPIFY_ACCESS_TOKEN
      },
      body: JSON.stringify(calculatePayload)
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to calculate refund: ${errorText}`);
  }

  const result = await response.json();
  const refund = result.refund;

  // Return calculated amounts
  return {
    success: true,
    calculation: {
      shipping: refund.shipping,
      refundLineItems: refund.refund_line_items || [],
      transactions: refund.transactions || [],
      currency: refund.currency,
      // Calculated totals
      subtotal: refund.refund_line_items?.reduce((sum, item) => sum + parseFloat(item.subtotal || 0), 0) || 0,
      totalTax: refund.refund_line_items?.reduce((sum, item) => sum + parseFloat(item.total_tax || 0), 0) || 0,
      shippingRefund: parseFloat(refund.shipping?.amount || 0),
      totalRefund: refund.transactions?.reduce((sum, t) => sum + Math.abs(parseFloat(t.amount || 0)), 0) || 0
    }
  };
}

/**
 * Execute refund (Stage 2) - Uses GraphQL mutation
 * Actually processes the refund after user confirmation
 */
async function executeRefund(env, orderId, data) {
  const gid = orderId.startsWith("gid://") ? orderId : `gid://shopify/Order/${orderId}`;

  const query = `
    mutation RefundCreate($input: RefundInput!) {
      refundCreate(input: $input) {
        refund {
          id
          note
          createdAt
          totalRefundedSet { 
            shopMoney { amount currencyCode } 
          }
          refundLineItems(first: 50) {
            edges {
              node {
                lineItem { id name sku }
                quantity
                restockType
                subtotalSet { shopMoney { amount } }
                totalTaxSet { shopMoney { amount } }
              }
            }
          }
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  // Build refund line items with location for restocking
  // Location ID must be provided from frontend or use environment default
  const locationId = data.locationId || env.DEFAULT_LOCATION_ID;

  // Map restock type values (frontend sends lowercase, GraphQL needs uppercase)
  const mapRestockType = (type) => {
    if (!type) return "NO_RESTOCK";
    const upperType = type.toUpperCase();
    // Valid Shopify restock types: NO_RESTOCK, CANCEL, RETURN, LEGACY_RESTOCK
    if (["NO_RESTOCK", "CANCEL", "RETURN", "LEGACY_RESTOCK"].includes(upperType)) {
      return upperType;
    }
    return "NO_RESTOCK";
  };

  const refundLineItems = (data.refundLineItems || []).map(item => {
    const restockType = mapRestockType(item.restockType || data.restockType);
    return {
      lineItemId: item.lineItemId.startsWith("gid://") ? item.lineItemId : `gid://shopify/LineItem/${item.lineItemId}`,
      quantity: parseInt(item.quantity),
      restockType,
      // Add locationId only when restocking (RETURN or CANCEL)
      ...(restockType !== "NO_RESTOCK" ? { locationId } : {})
    };
  });

  console.log('[Execute Refund] Restock type:', data.restockType, 'Line items:', JSON.stringify(refundLineItems));

  // Build shipping refund
  const shipping = data.shipping || {};
  const shippingInput = shipping.fullRefund
    ? { fullRefund: true }
    : { amount: parseFloat(shipping.amount || 0).toFixed(2) };

  // Calculate the refund amount from line items and shipping
  let refundAmount = 0;

  // Use totalRefundAmount if provided by frontend
  if (data.totalRefundAmount) {
    refundAmount = parseFloat(data.totalRefundAmount);
  } else if (data.calculatedRefund) {
    refundAmount = parseFloat(data.calculatedRefund.refund || 0);
  } else {
    // Fallback: calculate from line items
    for (const item of (data.refundLineItems || [])) {
      const unitPrice = parseFloat(item.unitPrice || 0);
      const qty = parseInt(item.quantity || 0);
      refundAmount += unitPrice * qty;
    }
    // Add shipping
    refundAmount += parseFloat(data.shipping?.amount || 0);
  }

  console.log('[Execute Refund] Calculated refund amount:', refundAmount);

  // Build transactions array - required for actual monetary refund
  // Note: For Shopify GraphQL refundCreate, transactions require orderId (required) and parentId (optional)
  const transactions = [];
  if (refundAmount > 0) {
    const transaction = {
      amount: refundAmount.toFixed(2),
      gateway: data.gateway || "manual",
      kind: "REFUND",
      orderId: gid  // Required field for OrderTransactionInput
    };

    // Add parentId if we have a parent transaction (for gateway refunds like Stripe, PayPal)
    if (data.parentTransactionId) {
      transaction.parentId = data.parentTransactionId;
    }

    transactions.push(transaction);
  }

  console.log('[Execute Refund] Transactions:', JSON.stringify(transactions));

  const refundInput = {
    orderId: gid,
    note: data.note || data.reason || "",
    notify: data.notifyCustomer !== false,
    shipping: shippingInput,
    refundLineItems: refundLineItems,
    // Include transactions for monetary refund
    ...(transactions.length > 0 ? { transactions } : {})
  };

  console.log('[Execute Refund] Input:', JSON.stringify(refundInput, null, 2));

  const result = await shopifyGraphQL(env, query, { input: refundInput });

  console.log('[Execute Refund] Result:', JSON.stringify(result, null, 2));

  if (result.refundCreate.userErrors?.length > 0) {
    const errors = result.refundCreate.userErrors;
    // Check for specific error types
    const insufficientFunds = errors.some(e => e.message.toLowerCase().includes("insufficient"));
    const alreadyRefunded = errors.some(e => e.message.toLowerCase().includes("already refunded") || e.message.toLowerCase().includes("already been refunded"));

    if (insufficientFunds) {
      throw new Error("Insufficient funds available for refund. Please check the payment gateway.");
    }
    if (alreadyRefunded) {
      throw new Error("These items have already been refunded.");
    }
    throw new Error(errors.map(e => e.message).join(", "));
  }

  const refund = result.refundCreate.refund;

  return {
    success: true,
    refund: {
      id: refund.id,
      note: refund.note,
      createdAt: refund.createdAt,
      totalRefunded: refund.totalRefundedSet?.shopMoney?.amount,
      currency: refund.totalRefundedSet?.shopMoney?.currencyCode,
      lineItems: refund.refundLineItems?.edges?.map(e => ({
        lineItem: e.node.lineItem,
        quantity: e.node.quantity,
        restockType: e.node.restockType,
        subtotal: e.node.subtotalSet?.shopMoney?.amount,
        totalTax: e.node.totalTaxSet?.shopMoney?.amount
      })) || []
    }
  };
}

/**
 * Get order timeline/events
 */
async function getOrderTimeline(env, orderId) {
  const gid = orderId.startsWith("gid://") ? orderId : `gid://shopify/Order/${orderId}`;

  const query = `
    query GetOrderTimeline($id: ID!) {
      order(id: $id) {
        id
        name
        events(first: 100, sortKey: CREATED_AT, reverse: true) {
          edges {
            node {
              id
              createdAt
              message
              attributeToApp
              attributeToUser
              criticalAlert
              ... on CommentEvent {
                author { name }
                rawBody
                canDelete
                canEdit
              }
            }
          }
        }
      }
    }
  `;

  const result = await shopifyGraphQL(env, query, { id: gid });

  if (!result.order) {
    throw new Error("Order not found");
  }

  return {
    success: true,
    events: result.order.events.edges.map(e => e.node)
  };
}

/**
 * Get shipping rates for order (placeholder - requires carrier service integration)
 */
async function getShippingRates(env, orderId) {
  // This would require integration with carrier services
  // For now, return a placeholder response
  return {
    success: true,
    message: "Shipping rates require carrier service integration",
    rates: []
  };
}

/**
 * Update customer profile (name, email, phone, password)
 * Used by Customer Account page
 */
async function updateCustomerProfile(env, customerId, data, signature) {
  // 1. Security Check: Verify Signature
  // This ensures the request comes from the authenticated storefront session
  const secret = "skm-customer-update-secret";
  const expectedSignature = await hmacSha256(secret, customerId);

  if (!signature || signature !== expectedSignature) {
    // Log for debugging
    console.warn(`[Auth Fail] ID: ${customerId}, Sig: ${signature}, Expected: ${expectedSignature}`);
    throw new Error("Unauthorized: Invalid signature");
  }

  // Add global ID prefix if missing
  const gid = customerId.startsWith("gid://") ? customerId : `gid://shopify/Customer/${customerId}`;

  let input = {
    id: gid
  };

  if (data.firstName) input.firstName = data.firstName;
  if (data.lastName) input.lastName = data.lastName;
  if (data.email) input.email = data.email;
  // Format phone number to E.164 if possible, or just pass it through for Shopify to validate
  if (data.phone) input.phone = data.phone;
  if (data.password) input.password = data.password;

  const mutation = `
    mutation customerUpdate($input: CustomerInput!) {
      customerUpdate(input: $input) {
        customer {
          id
          firstName
          lastName
          email
          phone
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  try {
    const result = await shopifyGraphQL(env, mutation, { input });

    if (result.customerUpdate?.userErrors?.length > 0) {
      const errorMessages = result.customerUpdate.userErrors.map(e => e.message).join(', ');
      throw new Error(errorMessages);
    }

    return { success: true, customer: result.customerUpdate.customer };
  } catch (e) {
    console.error('[updateCustomerProfile] Error:', e);
    throw new Error(`Failed to update profile: ${e.message}`);
  }
}

/**
 * HMCA SHA256 Helper
 */
async function hmacSha256(secret, message) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(message)
  );
  return Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Send order confirmation email
 */
async function sendOrderReceipt(env, orderId) {
  const gid = orderId.startsWith("gid://") ? orderId : `gid://shopify/Order/${orderId}`;

  // Use GraphQL orderInvoiceSend mutation to send order notification
  const mutation = `
    mutation OrderInvoiceSend($id: ID!) {
      orderInvoiceSend(id: $id) {
        order {
          id
          name
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  try {
    const result = await shopifyGraphQL(env, mutation, { id: gid });

    console.log('[sendOrderReceipt] Response:', JSON.stringify(result));

    if (result.orderInvoiceSend?.userErrors?.length > 0) {
      const errorMessages = result.orderInvoiceSend.userErrors.map(e => e.message).join(', ');
      throw new Error(errorMessages);
    }

    return { success: true, message: "Order receipt sent" };
  } catch (err) {
    console.error('[sendOrderReceipt] Error:', err);
    throw new Error(`Failed to send receipt: ${err.message}`);
  }
}

// ============================================
// SHOPIFY GRAPHQL CLIENT
// ============================================
async function shopifyGraphQL(env, query, variables = {}) {
  const response = await fetch(
    `https://${env.SHOPIFY_DOMAIN}/admin/api/2024-07/graphql.json`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": env.SHOPIFY_ACCESS_TOKEN,
      },
      body: JSON.stringify({ query, variables }),
    }
  );

  if (!response.ok) {
    throw new Error(`Shopify API error: ${response.status}`);
  }

  const json = await response.json();

  if (json.errors) {
    console.error("GraphQL Errors:", json.errors);
    throw new Error(json.errors.map(e => e.message).join(", "));
  }

  return json.data;
}

// ============================================
// DEALER MANAGEMENT OPERATIONS
// ============================================

/**
 * Initialize Dealer and Dealer_Application metaobject schemas
 */
async function initDealerSchemas(env) {
  // Check if Dealer schema exists
  const checkQuery = `
    query CheckDealerSchema {
      metaobjectDefinitionByType(type: "dealer") {
        id
        name
      }
      appMetaobjectDefinitionByType: metaobjectDefinitionByType(type: "dealer_application") {
        id
        name
      }
    }
  `;

  const checkResult = await shopifyGraphQL(env, checkQuery, {});
  const results = { dealer: null, dealer_application: null };

  // Create Dealer schema if not exists
  if (!checkResult.metaobjectDefinitionByType) {
    const createDealerSchema = `
      mutation CreateDealerDefinition {
        metaobjectDefinitionCreate(definition: {
          type: "dealer"
          name: "Dealer"
          displayNameKey: "name"
          access: { storefront: PUBLIC_READ }
          fieldDefinitions: [
            { key: "name", name: "Business Name", type: "single_line_text_field", required: true }
            { key: "logo", name: "Logo", type: "file_reference" }
            { key: "address", name: "Street Address", type: "single_line_text_field" }
            { key: "city", name: "City", type: "single_line_text_field" }
            { key: "state", name: "State", type: "single_line_text_field" }
            { key: "zip", name: "ZIP Code", type: "single_line_text_field" }
            { key: "country", name: "Country", type: "single_line_text_field" }
            { key: "latitude", name: "Latitude", type: "number_decimal" }
            { key: "longitude", name: "Longitude", type: "number_decimal" }
            { key: "phone", name: "Phone", type: "single_line_text_field" }
            { key: "email", name: "Email", type: "single_line_text_field" }
            { key: "website", name: "Website", type: "url" }
            { key: "hours", name: "Business Hours", type: "json" }
            { key: "customer_id", name: "Customer ID", type: "single_line_text_field" }
            { key: "status", name: "Status", type: "single_line_text_field" }
          ]
        }) {
          metaobjectDefinition { id name }
          userErrors { field message }
        }
      }
    `;
    const dealerResult = await shopifyGraphQL(env, createDealerSchema, {});
    results.dealer = dealerResult.metaobjectDefinitionCreate;
  } else {
    results.dealer = { existing: true, id: checkResult.metaobjectDefinitionByType.id };
  }

  // Create Dealer_Application schema if not exists
  if (!checkResult.appMetaobjectDefinitionByType) {
    const createAppSchema = `
      mutation CreateDealerApplicationDefinition {
        metaobjectDefinitionCreate(definition: {
          type: "dealer_application"
          name: "Dealer Application"
          displayNameKey: "business_name"
          access: { storefront: NONE }
          fieldDefinitions: [
            { key: "status", name: "Status", type: "single_line_text_field", required: true }
            { key: "business_name", name: "Business Name", type: "single_line_text_field", required: true }
            { key: "raw_data", name: "Application Data", type: "json" }
            { key: "customer_id", name: "Customer ID", type: "single_line_text_field" }
            { key: "customer_email", name: "Customer Email", type: "single_line_text_field" }
            { key: "submitted_at", name: "Submitted At", type: "date_time" }
            { key: "processed_at", name: "Processed At", type: "date_time" }
            { key: "processed_by", name: "Processed By", type: "single_line_text_field" }
            { key: "notes", name: "Admin Notes", type: "multi_line_text_field" }
          ]
        }) {
          metaobjectDefinition { id name }
          userErrors { field message }
        }
      }
    `;
    const appResult = await shopifyGraphQL(env, createAppSchema, {});
    results.dealer_application = appResult.metaobjectDefinitionCreate;
  } else {
    results.dealer_application = { existing: true, id: checkResult.appMetaobjectDefinitionByType.id };
  }

  return { success: true, schemas: results };
}

/**
 * List all active dealers
 */
async function listDealers(env, statusFilter = 'active') {
  const query = `
     query ListDealers($first: Int!) {
       metaobjects(type: "dealer", first: $first) {
         edges {
           node {
             id
             handle
             fields {
               key
               value
               reference {
                 ... on MediaImage {
                   image { url }
                 }
               }
             }
           }
         }
       }
     }
   `;

  const result = await shopifyGraphQL(env, query, { first: 250 });

  const dealers = result.metaobjects.edges.map(edge => {
    const fields = {};
    edge.node.fields.forEach(f => {
      if (f.key === 'logo' && f.reference?.image?.url) {
        fields[f.key] = f.reference.image.url;
      } else if (f.key === 'hours' && f.value) {
        try { fields[f.key] = JSON.parse(f.value); } catch { fields[f.key] = f.value; }
      } else {
        fields[f.key] = f.value;
      }
    });
    return {
      id: edge.node.id,
      handle: edge.node.handle,
      ...fields
    };
  }).filter(d => statusFilter === 'all' || d.status === statusFilter);

  return { success: true, data: dealers, count: dealers.length };
}

/**
 * Get single dealer by ID
 */
async function getDealer(env, id) {
  const gid = id.startsWith('gid://') ? id : `gid://shopify/Metaobject/${id}`;

  const query = `
    query GetDealer($id: ID!) {
      metaobject(id: $id) {
        id
        handle
        fields {
          key
          value
          reference {
            ... on MediaImage {
              image { url }
            }
          }
        }
      }
    }
  `;

  const result = await shopifyGraphQL(env, query, { id: gid });

  console.log('[getDealer] Input ID:', id);
  console.log('[getDealer] GID used:', gid);
  console.log('[getDealer] GraphQL result:', JSON.stringify(result));

  if (!result.metaobject) {
    return { success: false, error: "Dealer not found" };
  }

  const fields = {};
  result.metaobject.fields.forEach(f => {
    if (f.key === 'logo' && f.reference?.image?.url) {
      fields[f.key] = f.reference.image.url;
    } else if (f.key === 'hours' && f.value) {
      try { fields[f.key] = JSON.parse(f.value); } catch { fields[f.key] = f.value; }
    } else {
      fields[f.key] = f.value;
    }
  });

  return {
    success: true,
    data: {
      id: result.metaobject.id,
      handle: result.metaobject.handle,
      ...fields
    }
  };
}

/**
 * Create a new dealer
 */
async function createDealer(env, data) {
  const fields = [];

  const fieldMappings = ['name', 'address', 'city', 'state', 'zip', 'country', 'phone', 'email', 'website', 'customer_id', 'status'];
  fieldMappings.forEach(key => {
    if (data[key]) {
      fields.push({ key, value: data[key] });
    }
  });

  // Auto-geocode if missing coordinates but address is provided
  if (!data.latitude && !data.longitude && data.address && data.city) {
    const coords = await geocodeAddress(data.address, data.city, data.state, data.zip);
    if (coords) {
      data.latitude = coords.lat;
      data.longitude = coords.lng;
    }
  }

  if (data.latitude) fields.push({ key: 'latitude', value: String(data.latitude) });
  if (data.longitude) fields.push({ key: 'longitude', value: String(data.longitude) });
  if (data.hours) fields.push({ key: 'hours', value: JSON.stringify(data.hours) });
  if (!data.status) fields.push({ key: 'status', value: 'active' });

  const mutation = `
    mutation CreateDealer($metaobject: MetaobjectCreateInput!) {
      metaobjectCreate(metaobject: $metaobject) {
        metaobject {
          id
          handle
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  const result = await shopifyGraphQL(env, mutation, {
    metaobject: {
      type: "dealer",
      fields
    }
  });

  if (result.metaobjectCreate.userErrors?.length > 0) {
    return { success: false, errors: result.metaobjectCreate.userErrors };
  }

  return { success: true, data: result.metaobjectCreate.metaobject };
}

/**
 * Update dealer
 */
async function updateDealer(env, id, data) {
  const gid = id.startsWith('gid://') ? id : `gid://shopify/Metaobject/${id}`;

  const fields = [];
  const fieldMappings = ['name', 'address', 'city', 'state', 'zip', 'country', 'phone', 'email', 'website', 'status'];
  fieldMappings.forEach(key => {
    if (data[key] !== undefined) {
      fields.push({ key, value: data[key] });
    }
  });

  // Handle B2B account switching
  if (data.accountSwitch) {
    const { oldCustomerId, newCustomerId } = data.accountSwitch;

    console.log('[updateDealer] Account switch detected:', data.accountSwitch);

    try {
      // Remove b2b and dealer tags from old customer
      // NOTE: This only removes b2b/dealer, any other tags (like 'admin') are preserved
      if (oldCustomerId) {
        console.log('[updateDealer] Removing b2b/dealer tags from old customer:', oldCustomerId);
        await removeCustomerTags(env, oldCustomerId, ['b2b', 'dealer']);
      }

      // Add b2b and dealer tags to new customer
      // NOTE: tagsAdd only adds tags, it does NOT remove existing tags
      // If the new customer already has 'admin' or other tags, they will be preserved
      if (newCustomerId) {
        console.log('[updateDealer] Adding b2b/dealer tags to new customer:', newCustomerId);
        await addCustomerTags(env, newCustomerId, ['b2b', 'dealer']);

        // Update the customer_id field in dealer metaobject
        const newCustomerGid = newCustomerId.startsWith('gid://') ? newCustomerId : `gid://shopify/Customer/${newCustomerId}`;
        fields.push({ key: 'customer_id', value: newCustomerGid });
      }
    } catch (err) {
      console.error('[updateDealer] Error during account switch:', err);
      return { success: false, error: 'Failed to switch B2B account: ' + err.message };
    }
  }

  // Auto-geocode if address fields are being updated or lat/lng is missing
  if (data.address || data.city || data.state || data.zip) {
    // If updating address but not providing coordinates, we should try to geocode
    if (!data.latitude && !data.longitude) {
      // NOTE: Ideally we'd need the FULL address (including existing fields if partial update), 
      // but simpler logic is: if any address part changes, we try to geocode with what we have 
      // relative to the dealer's current info. 
      // HOWEVER, fetching the current dealer first adds latency. 
      // For now, we assume if address is updated, enough info is provided or available.
      // Better strategy: Only geocode if at least Address and City are present in data.

      if (data.address && data.city) {
        const coords = await geocodeAddress(data.address, data.city, data.state, data.zip);
        if (coords) {
          data.latitude = coords.lat;
          data.longitude = coords.lng;
        }
      }
    }
  }

  if (data.latitude !== undefined) fields.push({ key: 'latitude', value: String(data.latitude) });
  if (data.longitude !== undefined) fields.push({ key: 'longitude', value: String(data.longitude) });
  if (data.hours !== undefined) fields.push({ key: 'hours', value: JSON.stringify(data.hours) });

  const mutation = `
    mutation UpdateDealer($id: ID!, $metaobject: MetaobjectUpdateInput!) {
      metaobjectUpdate(id: $id, metaobject: $metaobject) {
        metaobject { id handle }
        userErrors { field message }
      }
    }
  `;

  const result = await shopifyGraphQL(env, mutation, {
    id: gid,
    metaobject: { fields }
  });

  if (result.metaobjectUpdate.userErrors?.length > 0) {
    return { success: false, errors: result.metaobjectUpdate.userErrors };
  }

  return { success: true, data: result.metaobjectUpdate.metaobject };
}

/**
 * Delete dealer
 */
async function deleteDealer(env, id) {
  const gid = id.startsWith('gid://') ? id : `gid://shopify/Metaobject/${id}`;

  // Step 1: Get the dealer first to find the customer_id
  const dealerResult = await getDealer(env, gid);

  if (dealerResult.success && dealerResult.data.customer_id) {
    // Remove 'b2b' and 'dealer' tags from the customer
    await removeCustomerTags(env, dealerResult.data.customer_id, ['b2b', 'dealer']);
  }

  const mutation = `
    mutation DeleteDealer($id: ID!) {
      metaobjectDelete(id: $id) {
        deletedId
        userErrors { field message }
      }
    }
  `;

  const result = await shopifyGraphQL(env, mutation, { id: gid });

  if (result.metaobjectDelete.userErrors?.length > 0) {
    return { success: false, errors: result.metaobjectDelete.userErrors };
  }
  return { success: true, deletedId: result.metaobjectDelete.deletedId };
}

/**
 * Helper: Geocode address using Nominatim (OpenStreetMap)
 */
async function geocodeAddress(address, city, state, zip) {
  try {
    const query = [address, city, state, zip, "USA"].filter(Boolean).join(", ");
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`;

    const response = await fetch(url, {
      headers: {
        "User-Agent": "SKM-Inventory-Manager/1.0 (miaotingshuo890@gmail.com)"
      }
    });

    if (!response.ok) return null;

    const data = await response.json();
    if (data && data.length > 0) {
      return {
        lat: data[0].lat,
        lng: data[0].lon
      };
    }
  } catch (error) {
    console.error("Geocoding error:", error);
  }
  return null;
}

/**
 * Backfill geocoding for existing dealers
 */
async function backfillGeocoding(env) {
  const result = await listDealers(env);
  if (!result.success) return result;

  const dealers = result.data;
  let updatedCount = 0;
  let skippedCount = 0;
  let failedCount = 0;
  const logs = [];

  for (const dealer of dealers) {
    // Check if missing coordinates
    if (!dealer.latitude && !dealer.longitude && dealer.address && dealer.city) {
      try {
        logs.push(`Geocoding dealer: ${dealer.name} (${dealer.address}, ${dealer.city})`);

        // Rate limiting: wait 1.2 seconds between requests
        await new Promise(resolve => setTimeout(resolve, 1200));

        const coords = await geocodeAddress(dealer.address, dealer.city, dealer.state, dealer.zip);

        if (coords) {
          // Update the dealer
          const updateResult = await updateDealer(env, dealer.id, {
            latitude: coords.lat,
            longitude: coords.lng
          });

          if (updateResult.success) {
            updatedCount++;
            logs.push(`  -> Success: ${coords.lat}, ${coords.lng}`);
          } else {
            failedCount++;
            logs.push(`  -> Update failed: ${JSON.stringify(updateResult.errors)}`);
          }
        } else {
          failedCount++;
          logs.push(`  -> Geocoding failed (no results)`);
        }
      } catch (e) {
        failedCount++;
        logs.push(`  -> Error: ${e.message}`);
      }
    } else {
      skippedCount++;
    }
  }

  return {
    success: true,
    total: dealers.length,
    updated: updatedCount,
    skipped: skippedCount,
    failed: failedCount,
    logs
  };
}

/**
 * Get favicon URL for a website using Google's Favicon API
 * @param {string} websiteUrl - The website URL
 * @returns {string|null} The favicon URL or null if no website provided
 */
function getFaviconUrl(websiteUrl) {
  if (!websiteUrl) return null;
  try {
    // Extract domain from URL
    return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64`;
  } catch (e) {
    console.error('[getFaviconUrl] Error parsing website URL:', e);
    return null;
  }
}

/**
 * Apply to become a dealer (submit application)
 */
async function applyForDealer(env, data) {
  if (!data.customer_id || !data.customer_email) {
    return { success: false, error: "Customer ID and email are required" };
  }

  // Check for existing pending application from this customer
  const existingQuery = `
    query FindExistingApplication($first: Int!) {
      metaobjects(type: "dealer_application", first: $first) {
        edges {
          node {
            id
            fields {
              key
              value
            }
          }
        }
      }
    }
  `;

  const existingResult = await shopifyGraphQL(env, existingQuery, { first: 250 });

  // Find ALL existing pending applications from this customer
  const existingApps = existingResult.metaobjects?.edges?.filter(edge => {
    const customerIdField = edge.node.fields.find(f => f.key === 'customer_id');
    const statusField = edge.node.fields.find(f => f.key === 'status');
    return customerIdField?.value === data.customer_id && statusField?.value === 'pending';
  }) || [];

  // Delete ALL old pending applications from this customer
  if (existingApps.length > 0) {
    console.log(`[applyForDealer] Deleting ${existingApps.length} old applications from customer ${data.customer_id}`);

    const deleteMutation = `
      mutation DeleteDealerApplication($id: ID!) {
        metaobjectDelete(id: $id) {
          deletedId
          userErrors {
            field
            message
          }
        }
      }
    `;

    // Delete each old application
    for (const app of existingApps) {
      try {
        await shopifyGraphQL(env, deleteMutation, { id: app.node.id });
      } catch (err) {
        console.error(`Failed to delete old application ${app.node.id}:`, err);
      }
    }
  }

  // Extract favicon URL from website if provided
  const faviconUrl = getFaviconUrl(data.website);
  if (faviconUrl) {
    data.favicon_url = faviconUrl;
  }

  const fields = [
    { key: 'status', value: 'pending' },
    { key: 'business_name', value: data.business_name || 'Unnamed Business' },
    { key: 'customer_id', value: data.customer_id },
    { key: 'customer_email', value: data.customer_email },
    { key: 'submitted_at', value: new Date().toISOString() },
    { key: 'raw_data', value: JSON.stringify(data) }
  ];

  // Always create a new application
  // Create new application
  const createMutation = `
      mutation CreateDealerApplication($metaobject: MetaobjectCreateInput!) {
        metaobjectCreate(metaobject: $metaobject) {
          metaobject {
            id
            handle
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

  console.log('[applyForDealer] Creating application with fields:', JSON.stringify(fields));

  const result = await shopifyGraphQL(env, createMutation, {
    metaobject: {
      type: "dealer_application",
      fields
    }
  });

  console.log('[applyForDealer] Shopify result:', JSON.stringify(result));

  if (result.metaobjectCreate?.userErrors?.length > 0) {
    console.error('[applyForDealer] User errors:', result.metaobjectCreate.userErrors);
    return { success: false, errors: result.metaobjectCreate.userErrors };
  }

  if (!result.metaobjectCreate?.metaobject?.id) {
    console.error('[applyForDealer] No metaobject returned - possible schema mismatch');
    return { success: false, error: 'Failed to create application - schema may not be initialized' };
  }

  // Send email notification to shop owner (optional - requires RESEND_API_KEY)
  if (env.RESEND_API_KEY && env.SHOP_OWNER_EMAIL) {
    try {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${env.RESEND_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: 'SKM Dealer Applications <onboarding@resend.dev>',
          to: env.SHOP_OWNER_EMAIL,
          subject: `🏪 New Dealer Application: ${data.business_name || 'New Business'}`,
          text: `New dealer application from ${data.business_name || 'New Business'}. Email: ${data.customer_email}. Phone: ${data.phone || 'N/A'}. Address: ${data.address || ''}, ${data.city || ''}, ${data.state || ''} ${data.zip || ''}. Review at: https://skm-ex.myshopify.com/pages/admin-dashboard`,
          html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f4f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f5; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #dc2626 0%, #991b1b 100%); padding: 32px 40px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 700;">SKM Performance</h1>
              <p style="margin: 8px 0 0 0; color: rgba(255,255,255,0.9); font-size: 14px;">Dealer Application Notification</p>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <div style="background-color: #fef2f2; border-left: 4px solid #dc2626; padding: 16px 20px; border-radius: 0 8px 8px 0; margin-bottom: 32px;">
                <p style="margin: 0; color: #991b1b; font-weight: 600; font-size: 16px;">🎉 New Application Received!</p>
                <p style="margin: 8px 0 0 0; color: #7f1d1d; font-size: 14px;">A potential dealer is interested in partnering with SKM.</p>
              </div>
              
              <h2 style="margin: 0 0 24px 0; color: #18181b; font-size: 20px; font-weight: 600;">Business Details</h2>
              
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 32px;">
                <tr>
                  <td style="padding: 12px 0; border-bottom: 1px solid #e4e4e7;">
                    <span style="color: #71717a; font-size: 14px;">Business Name</span><br>
                    <span style="color: #18181b; font-size: 16px; font-weight: 500;">${data.business_name || 'Not provided'}</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 12px 0; border-bottom: 1px solid #e4e4e7;">
                    <span style="color: #71717a; font-size: 14px;">Contact Email</span><br>
                    <a href="mailto:${data.customer_email}" style="color: #dc2626; font-size: 16px; font-weight: 500; text-decoration: none;">${data.customer_email}</a>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 12px 0; border-bottom: 1px solid #e4e4e7;">
                    <span style="color: #71717a; font-size: 14px;">Phone</span><br>
                    <span style="color: #18181b; font-size: 16px; font-weight: 500;">${data.phone || 'Not provided'}</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 12px 0; border-bottom: 1px solid #e4e4e7;">
                    <span style="color: #71717a; font-size: 14px;">Location</span><br>
                    <span style="color: #18181b; font-size: 16px; font-weight: 500;">${[data.address, data.city, data.state, data.zip].filter(Boolean).join(', ') || 'Not provided'}</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 12px 0; border-bottom: 1px solid #e4e4e7;">
                    <span style="color: #71717a; font-size: 14px;">Website</span><br>
                    <a href="${data.website || '#'}" style="color: #dc2626; font-size: 16px; font-weight: 500; text-decoration: none;">${data.website || 'Not provided'}</a>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 12px 0;">
                    <span style="color: #71717a; font-size: 14px;">Reason for Applying</span><br>
                    <span style="color: #18181b; font-size: 16px; font-weight: 500;">${data.reason || 'Not provided'}</span>
                  </td>
                </tr>
              </table>
              
              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="https://skm-ex.myshopify.com/pages/admin-dashboard?tab=dealers&app=${encodeURIComponent(result.metaobjectCreate.metaobject.id)}" style="display: inline-block; background-color: #dc2626; color: #ffffff; padding: 14px 32px; border-radius: 8px; font-size: 16px; font-weight: 600; text-decoration: none;">
                      Review Application →
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f4f4f5; padding: 24px 40px; text-align: center;">
              <p style="margin: 0; color: #71717a; font-size: 12px;">
                This is an automated notification from SKM Performance.<br>
                © ${new Date().getFullYear()} SKM Performance. All rights reserved.
              </p>
            </td>
          </tr>
          
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
          `
        })
      });
    } catch (emailError) {
      console.error('Failed to send notification email:', emailError);
      // Don't fail the application if email fails
    }
  }

  return {
    success: true,
    message: "Application submitted successfully! We'll review it and get back to you soon.",
    applicationId: result.metaobjectCreate.metaobject.id
  };
}

/**
 * List dealer applications (admin only)
 */
async function listDealerApplications(env, statusFilter = "") {
  const query = `
    query ListDealerApplications($first: Int!) {
      metaobjects(type: "dealer_application", first: $first, reverse: true) {
        edges {
          node {
            id
            handle
            fields {
              key
              value
            }
          }
        }
      }
    }
  `;

  const result = await shopifyGraphQL(env, query, { first: 250 });

  console.log('[listDealerApplications] Query result:', JSON.stringify(result));
  console.log('[listDealerApplications] Status filter:', statusFilter);

  const applications = result.metaobjects?.edges?.map(edge => {
    const fields = {};
    edge.node.fields.forEach(f => {
      if (f.key === 'raw_data' && f.value) {
        try { fields[f.key] = JSON.parse(f.value); } catch { fields[f.key] = f.value; }
      } else {
        fields[f.key] = f.value;
      }
    });
    return {
      id: edge.node.id,
      handle: edge.node.handle,
      ...fields
    };
  }).filter(app => !statusFilter || app.status === statusFilter) || [];

  return { success: true, data: applications, count: applications?.length || 0 };
}

/**
 * Get single dealer application
 */
async function getDealerApplication(env, id) {
  // Decode URL-encoded ID (frontend encodes it to handle slashes in GID)
  const decodedId = decodeURIComponent(id);
  const gid = decodedId.startsWith('gid://') ? decodedId : `gid://shopify/Metaobject/${decodedId}`;

  const query = `
    query GetDealerApplication($id: ID!) {
      metaobject(id: $id) {
        id
        handle
        fields {
          key
          value
        }
      }
    }
  `;

  const result = await shopifyGraphQL(env, query, { id: gid });

  if (!result.metaobject) {
    return { success: false, error: "Application not found" };
  }

  const fields = {};
  result.metaobject.fields.forEach(f => {
    if (f.key === 'raw_data' && f.value) {
      try { fields[f.key] = JSON.parse(f.value); } catch { fields[f.key] = f.value; }
    } else {
      fields[f.key] = f.value;
    }
  });

  return {
    success: true,
    data: {
      id: result.metaobject.id,
      handle: result.metaobject.handle,
      ...fields
    }
  };
}

/**
 * Process application (approve or reject)
 */
async function processApplication(env, data) {
  const { applicationId, action, notes, processedBy } = data;
  let emailStatus = '';

  if (!applicationId || !action) {
    return { success: false, error: "applicationId and action are required" };
  }

  if (!['approve', 'reject'].includes(action)) {
    return { success: false, error: "Action must be 'approve' or 'reject'" };
  }

  // Get the application first
  const appResult = await getDealerApplication(env, applicationId);
  if (!appResult.success) {
    return appResult;
  }

  const application = appResult.data;
  const gid = applicationId.startsWith('gid://') ? applicationId : `gid://shopify/Metaobject/${applicationId}`;

  // Update application status
  const updateFields = [
    { key: 'status', value: action === 'approve' ? 'approved' : 'rejected' },
    { key: 'processed_at', value: new Date().toISOString() }
  ];
  if (notes) updateFields.push({ key: 'notes', value: notes });
  if (processedBy) updateFields.push({ key: 'processed_by', value: processedBy });

  const updateMutation = `
    mutation UpdateApplication($id: ID!, $metaobject: MetaobjectUpdateInput!) {
      metaobjectUpdate(id: $id, metaobject: $metaobject) {
        metaobject { id }
        userErrors { field message }
      }
    }
  `;

  await shopifyGraphQL(env, updateMutation, {
    id: gid,
    metaobject: { fields: updateFields }
  });

  let dealerId = null;

  if (action === 'approve') {
    // Create the Dealer metaobject
    const rawData = application.raw_data || {};
    const dealerData = {
      name: application.business_name || rawData.business_name,
      address: rawData.address,
      city: rawData.city,
      state: rawData.state,
      zip: rawData.zip,
      country: rawData.country || 'United States',
      phone: rawData.phone,
      email: application.customer_email,
      website: rawData.website,
      hours: rawData.hours,
      latitude: rawData.latitude,
      longitude: rawData.longitude,
      customer_id: application.customer_id,
      status: 'active'
    };

    const dealerResult = await createDealer(env, dealerData);
    if (dealerResult.success) {
      dealerId = dealerResult.data.id;
    }

    // Add 'b2b' tag to customer
    if (application.customer_id) {
      await addCustomerTags(env, application.customer_id, ['b2b', 'dealer']);
    }
  } else if (action === 'reject') {
    // Email is now handled by frontend via mailto link
  }

  return {
    success: true,
    message: action === 'approve' ? 'Application approved! Dealer created and customer tagged.' : 'Application rejected.',
    dealerId,
    customerId: application.customer_id
  };
}

/**
 * Get current customer's dealer profile (B2B only)
 */
async function getMyDealer(env, customerId) {
  if (!customerId) {
    return { success: false, error: "Customer ID is required" };
  }

  const query = `
    query GetDealerByCustomer($first: Int!, $query: String!) {
      metaobjects(type: "dealer", first: $first, query: $query) {
        edges {
          node {
            id
            handle
            fields {
              key
              value
              reference {
                ... on MediaImage {
                  image { url }
                }
              }
            }
          }
        }
      }
    }
  `;

  const result = await shopifyGraphQL(env, query, {
    first: 1,
    query: `fields.customer_id:${customerId}`
  });

  if (!result.metaobjects.edges.length) {
    return { success: false, error: "No dealer profile found for this customer" };
  }

  const node = result.metaobjects.edges[0].node;
  const fields = {};
  node.fields.forEach(f => {
    if (f.key === 'logo' && f.reference?.image?.url) {
      fields[f.key] = f.reference.image.url;
    } else if (f.key === 'hours' && f.value) {
      try { fields[f.key] = JSON.parse(f.value); } catch { fields[f.key] = f.value; }
    } else {
      fields[f.key] = f.value;
    }
  });

  return {
    success: true,
    data: {
      id: node.id,
      handle: node.handle,
      ...fields
    }
  };
}

/**
 * Update own dealer profile (B2B only)
 */
async function updateMyDealer(env, data) {
  const { customerId, ...updateData } = data;

  if (!customerId) {
    return { success: false, error: "Customer ID is required" };
  }

  // Get the dealer first to verify ownership
  const dealerResult = await getMyDealer(env, customerId);
  if (!dealerResult.success) {
    return dealerResult;
  }

  // Only allow updating certain fields
  const allowedFields = ['phone', 'website', 'hours', 'address', 'city', 'state', 'zip'];
  const filteredData = {};
  allowedFields.forEach(key => {
    if (updateData[key] !== undefined) {
      filteredData[key] = updateData[key];
    }
  });

  return await updateDealer(env, dealerResult.data.id, filteredData);
}
