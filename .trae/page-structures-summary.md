# SKM Exhaust System - Page Structures Summary

## Overview
SKM is a high-performance exhaust system Shopify store with a sophisticated automotive theme. The design emphasizes precision engineering, performance metrics, and a technical aesthetic with strong red/black branding.

---

## 1. Main Page (Homepage)
**Template:** `templates/index.json`  
**Theme:** High-performance automotive showcase

### Structure:
```
Hero Section (hero-ymm)
├── Background video (3752531-hd_1920_1080_24fps.mp4) with Blur Scan Effect
├── Header: "VEHICLE IDENTIFICATION" (Diagnostic Theme)
└── NEW: Auto-sizing YMM fields + Right-aligned Search Button (Command Center Style)

Engineering Value Proposition
├── 3 Feature blocks:
│   ├── 304 Stainless Steel
│   ├── Mandrel Bent
│   └── Dyno Proven
└── Subheading: "PRECISION ENGINEERED"

The Redline Collection (showroom-masonry)
├── Grid layout (1-4 columns responsive)
├── 8 products displayed
├── Hover effects with white background overlay
├── Price display with discount/B2B logic
└── Stock status badges

Dyno Room
├── Performance specs display
├── 110dB Raw Output
└── +25 HP Dyno Proven Gain

The Garage (Interactive Hotspots)
├── Image with clickable hotspots
├── Anti-Drone Tech hotspot
└── TIG Welded hotspot
```

**Key Features:**
- Video hero with YMM integration
- Product grid with hover pricing
- Performance metrics showcase
- Interactive garage with hotspots

---

## 2. Product Page
**Template:** `templates/product.json`  
**Section:** `sections/main-product-precision.liquid`

### Structure:
```
Main Product Section
├── Product gallery with video looping
├── Product information
├── Collapsible tabs:
│   ├── Dyno Charts
│   ├── Material Specs
│   └── Installation Guide
└── Variant options

Vehicle Fitment Section
├── Compatible vehicles display
└── Fitment verification

Product Recommendations
├── "You may also like" section
├── Grid layout (4 products max)
└── Product cards with pricing
```

**Key Features:**
- Performance-focused tabs (dyno, specs, install)
- Vehicle compatibility display
- Related products recommendations
- Variant pricing with B2B/discount logic

---

## 3. All Products Page (Collection)
**Template:** `templates/collection.json`  
**Section:** `sections/main-collection.liquid`

### Structure:
```
Collection Header
├── NEW: HUD Vehicle Command Bar (Active Vehicle Display + Configure Button)
├── Collection Title & Description
└── YMM Configuration Modal (Dark HUD styling)

Filter & Sort Bar
├── Horizontal filter style
├── Product filtering
├── Sorting options
└── Grid density controls

Product Grid
├── Responsive layout (1-4 columns)
├── Product cards with:
│   ├── Image gallery
│   ├── Product title
│   └── Price display (with B2B/discount logic)
└── 16px horizontal gaps, 24px vertical gaps
```

**Key Features:**
- Advanced filtering and sorting
- Product cards with variant pricing logic
- Responsive grid layout
- Collection-specific styling

---

## 4. Admin Dashboard
**Template:** `templates/page.admin-dashboard.liquid`  
**Access:** Requires 'admin' customer tag

### Structure:
```
Header
├── Shop name + "Inventory Manager"
├── User email display
├── Account link
└── Logout button

Sidebar Navigation
├── Products section
│   ├── Search by title
│   ├── YMM filter (Year-Make-Model)
│   └── Product list with count
├── New Product button
└── Mobile-responsive sidebar

Main Content Area (3 tabs)
├── Products Tab
│   ├── Product editor
│   ├── Basic information (title, description, vendor, type, tags)
│   ├── Media management (upload/URL)
│   ├── Vehicle fitment management
│   └── Product options & variants
├── Vehicles Tab
│   ├── Vehicle creation/management
│   └── Vehicle filtering
└── Customers Tab
│   ├── Customer management
│   └── B2B upgrade functionality

Modals
├── Vehicle creation modal
└── Package management modal
```

**Key Features:**
- Full CRUD operations for products
- Vehicle fitment management
- Variant pricing with B2B/discount support
- Media upload and management
- Mobile-responsive design
- Real-time search and filtering
- **Lazy Loading Implementation:**
  - Upfront API calls removed from startup.
  - Data fetched only on tab activation (checked via `S.dataLoaded`).
  - Loading indicators shown for Products, Orders, Customers.
  - Categories and Profile scripts initialized lazily on tab visit.

---

## 5. Customer Login Page
**Template:** `templates/customers/login.json`  
**Section:** `sections/main-customer-login.liquid`

### Structure:
```
Page Header
├── Title: "Access Terminal"
└── Subtitle: "Secure Entry // My Garage"

Login Form
├── Email field
├── Password field
├── Remember me checkbox
├── Login button
└── "Forgot password?" link

Error Handling
├── Red alert box for errors
├── Access Denied messaging
└── Activation reminder for new registrations

Additional Links
├── "Create account" link
└── Return to store link
```

**Design Theme:**
- Technical/military aesthetic
- Red/black color scheme
- Uppercase tracking typography
- Terminal/Access control language

---

## 6. Customer Registration Page
**Template:** `templates/customers/register.json`  
**Section:** `sections/main-customer-register.liquid`

### Structure:
```
Page Header
├── Title: "New Profile"
└── Subtitle: "Initialize Driver Data"

Registration Form
├── First Name field
├── Last Name field
├── Email field
├── Password field
├── Register button
└── Login link

Success Handling
├── Green success box
├── Email verification message
└── Auto-redirect to login (3 seconds)

Error Handling
├── Red alert box for errors
└── Registration failed messaging
```

**Design Theme:**
- Technical initialization language
- Driver profile terminology
- Consistent with login aesthetic

---

## 7. Customer Account Page (Profile)
**Template:** `templates/customers/account.json`  
**Section:** `sections/main-customer-account.liquid`

### Structure:
```
Dashboard Header
├── Title: "My Garage"
├── Driver info: Name + Customer ID
└── Logout button

Layout (12-column grid)
├── Sidebar (3 columns)
│   ├── Driver Profile Card
│   │   ├── Name, email, address
│   │   └── Manage addresses link
│   └── B2B Upgrade Card (if not B2B)
│       ├── Upgrade call-to-action
│       └── Benefits list
└── Main Content (9 columns)
    ├── Recent Orders
    │   ├── Order history table
    │   └── Order status tracking
    └── Account Settings
        ├── Profile information
        └── Preferences
```

**Key Features:**
- Garage/Driver theme
- B2B upgrade functionality
- Order history with tracking
- Address management integration

---

## 8. Customer Addresses Page
**Template:** `templates/customers/addresses.json`  
**Section:** `sections/main-customer-addresses.liquid`

### Structure:
```
Page Header
├── Title: "Shipping Destinations"
└── Subtitle: "Logistics Command Center // Manage Delivery Points"

Add Address Button
└── Red CTA with plus icon

Address Grid (2-column layout)
├── Address Cards
│   ├── Default badge (if applicable)
│   ├── Formatted address (monospace font)
│   ├── Edit button
│   ├── Delete button
│   └── Set as default button
└── New Address Form (hidden by default)
    ├── All address fields
    └── Save/Cancel buttons

Pagination
└── 6 addresses per page
```

**Design Theme:**
- Logistics/Command center aesthetic
- Monospace fonts for addresses
- Technical terminology
- Red/black color scheme

---

## 9. Contact Page
**Template:** `templates/page.contact.json`  
**Section:** `sections/main-page-contact-custom.liquid`

### Structure:
```
Page Header
├── Title: "Engineering & Support"
└── Technical support description

Two-Column Layout
├── Left Column: Contact Information
│   ├── Headquarters Address
│   │   ├── Dallas, TX location
│   │   └── Map icon
│   ├── Email Contact
│   │   ├── support@skm-ex.com
│   │   └── Mail icon
│   └── Phone/Hours (if available)
└── Right Column: Contact Form
    ├── Name field
    ├── Email field
    ├── Subject field
    ├── Message textarea
    └── Send button

Form Handling
├── Validation
├── Success message
└── Error handling
```

**Design Theme:**
- Engineering/Technical support focus
- Professional contact information
- Clean split-grid layout
- Consistent branding

---

## 10. Dealer Discovery Page
**Template:** `templates/page.dealers.liquid` (Custom Liquid)
**Frontend Logic:** `assets/dealer-discovery.js`

### Structure:
```
Hero Section
├── Title: "Find a Dealer Near You"
└── Subtitle description

Split-Screen Content
├── Left Column: Dealer List
│   ├── Loading state / Empty state
│   ├── Scrollable list of dealers
│   └── Distance calculation (miles)
└── Right Column: Interactive Map
    ├── Leaflet.js map integration
    ├── Dealer markers
    └── User location marker

Become a Dealer Section
├── Collapsible application form
├── Business & Contact fields
└── "Submit Application" logic
```

**Key Features:**
- **Interactive Map:** Uses Leaflet/OpenStreetMap (no API key required)
- **Geolocation:** Requests user location to sort dealers by distance
- **Dealer Application:** Integrated form for customers to apply
- **Real-time Data:** Fetches dealers from Cloudflare Worker API

---

## Common Design Elements

### Color Scheme
- **Primary:** Black (#111111)
- **Accent:** Red (#CC0000)
- **Gray:** Various shades for text/ backgrounds
- **White:** Clean backgrounds

### Typography
- **Headings:** Uppercase, tight tracking, bold
- **Body:** Clean sans-serif (Inter)
- **Technical:** Monospace for addresses/data

### Interactive Elements
- **Hover Effects:** Scale, color transitions
- **Buttons:** Red CTAs, outlined secondary
- **Forms:** Clean inputs with red focus states
- **Cards:** Subtle shadows, hover elevations

### Responsive Design
- **Mobile:** Single column, stacked elements
- **Tablet:** 2-column layouts
- **Desktop:** Multi-column grids
- **Navigation:** Mobile hamburger menu

### Performance/Technical Theme
- **Language:** Garage, driver, engineering terms
- **Metrics:** Dyno charts, performance specs
- **Imagery:** Technical diagrams, product shots
- **Icons:** Automotive/technical symbols

---

## Technical Implementation

### Shopify Features Used
- **Templates:** JSON-based page templates
- **Sections:** Reusable content blocks
- **Snippets:** Price logic, components
- **Metafields:** B2B pricing, discounts
- **Customer Tags:** B2B, admin access control
- **Variants:** Product options with pricing

### Custom Functionality
- **B2B Pricing:** Tiered pricing system
- **Vehicle Fitment:** YMM compatibility
- **Admin Dashboard:** Custom inventory management
- **Discount Logic:** Variant-based pricing
- **Decimal Precision:** Custom price formatting

### Integration Points
- **Cloudflare Workers:** API endpoints
- **Shopify API:** Product/variant management
- **Metafields:** Custom data storage
- **Customer System:** Authentication, tags

---

## Component-to-File Mapping

### Global Components (All Pages)

| Component | File | Description |
|-----------|------|-------------|
| **Header** | `sections/header-precision.liquid` | Main site header with logo, nav, utilities |
| **Header Logo** | `sections/header-precision.liquid` (lines 41-96) | Dynamic logo from shop profile API |
| **Header JS** | `assets/header-precision.js` | Scroll behavior, mobile menu |
| **Category Nav Bar** | `sections/header-precision.liquid` (lines 234-362) | Product type navigation with YMM integration |
| **Footer** | `sections/blueprint-footer.liquid` | Site footer with social links, logo |
| **Footer Social Icons** | `sections/blueprint-footer.liquid` (lines 84-103) | Twitter, Instagram, Facebook, YouTube |
| **Favicon** | `assets/admin-profile.js` | Loaded lazily via `loadFavicon()` on page load (independent of Profile tab) |
| **Announcements** | `sections/header-announcements.liquid` | Top banner announcements |

### Homepage (`/`)

| Component | File | Description |
|-----------|------|-------------|
| **Template** | `templates/index.json` | Page configuration |
| **Hero Section** | `sections/hero-ymm.liquid` | Video hero with YMM search |
| **Value Props** | `sections/engineering-value-prop.liquid` | Feature blocks |
| **Showroom Grid** | `sections/showroom-masonry.liquid` | Product grid |
| **Dyno Room** | `sections/dyno-room.liquid` | Performance specs |
| **Garage Hotspots** | `sections/garage-hotspots.liquid` | Interactive image |

### Product Page (`/products/*`)

| Component | File | Description |
|-----------|------|-------------|
| **Template** | `templates/product.json` | Page configuration |
| **Main Product** | `sections/main-product-precision.liquid` | Product details, gallery, variant selector |
| **Fitment Section** | `sections/product-fitment.liquid` | Vehicle compatibility |
| **Recommendations** | `sections/product-recommendations.liquid` | Related products |
| **Price Logic** | `snippets/price.liquid` | B2B/discount/retail pricing |

### Collection Page (`/collections/*`)

| Component | File | Description |
|-----------|------|-------------|
| **Template** | `templates/collection.json` | Page configuration |
| **Main Collection** | `sections/main-collection.liquid` | Product grid with filters |
| **Type Filter JS** | `sections/main-collection.liquid` (lines 116-175) | Client-side product type filtering via `?type=` param |
| **Product Card** | `snippets/product-card.liquid` | Individual product cards |
| **Filters** | `snippets/collection-filters.liquid` | Filter sidebar |

### Admin Dashboard (`/pages/admin-dashboard`)

| Component | File | Description |
|-----------|------|-------------|
| **Template** | `templates/page.admin-dashboard.liquid` | Main dashboard template |
| **Profile Tab** | `snippets/admin-profile-tab.liquid` | Shop profile management |
| **Profile JS** | `assets/admin-profile.js` | Profile tab logic (logo upload, social links) |
| **Products Tab** | (inline in template) | Product CRUD operations |
| **Vehicles Tab** | (inline in template) | Vehicle management |
| **Customers Tab** | (inline in template) | Customer management |
| **Orders Tab** | (inline in template) | Order management |

### Customer Pages

| Page | Template | Section |
|------|----------|---------|
| **Login** | `templates/customers/login.json` | `sections/main-customer-login.liquid` |
| **Register** | `templates/customers/register.json` | `sections/main-customer-register.liquid` |
| **Account** | `templates/customers/account.json` | `sections/main-customer-account.liquid` |
| **Addresses** | `templates/customers/addresses.json` | `sections/main-customer-addresses.liquid` |
| **Order** | `templates/customers/order.json` | `sections/main-customer-order.liquid` |

### Contact Page (`/pages/contact`)

| Component | File | Description |
|-----------|------|-------------|
| **Template** | `templates/page.contact.json` | Page configuration |
| **Main Section** | `sections/main-page-contact-custom.liquid` | Contact form and info |

---

## Dynamic Data Sources (API-Driven)

| Data | Source | Used In |
|------|--------|---------|
| **Shop Logo** | `GET /shop/profile` → `data.logo` | Header, Footer, Favicon |
| **Social Links** | `GET /shop/profile` → `data.social_*` | Footer icons |
| **Shop Name** | `GET /shop/profile` → `data.name` | Header, Footer |
| **Products** | `GET /products` | Admin Dashboard |
| **Vehicles** | `GET /vehicles` | Admin Dashboard, Product fitment |
| **Customers** | `GET /customers` | Admin Dashboard |
| **Orders** | `GET /orders` | Admin Dashboard |

---

## Cloudflare Worker API Endpoints

| Endpoint | File | Purpose |
|----------|------|---------|
| **Shop Profile** | `cloudflare-worker/inventory-api.js` | `GET/PUT /shop/profile` |
| **Logo Upload** | `cloudflare-worker/inventory-api.js` | `POST /shop/logo/upload` |
| **Categories** | `cloudflare-worker/inventory-api.js` | `GET /categories?vehicleId=` - Product type counts (YMM filtered) |
| **Products** | `cloudflare-worker/inventory-api.js` | CRUD `/products/*` |
| **Vehicles** | `cloudflare-worker/inventory-api.js` | CRUD `/vehicles/*` |
| **Customers** | `cloudflare-worker/inventory-api.js` | CRUD `/customers/*` |
| **Orders** | `cloudflare-worker/inventory-api.js` | `/orders/*` |
| **B2B Checkout** | `cloudflare-worker/inventory-api.js` | `/checkout/b2b` |

---

## Theme Settings

| Setting | File | Used For |
|---------|------|----------|
| **Logo** | `config/settings_schema.json` | Default theme logo (if no profile logo) |
| **Colors** | `config/settings_schema.json` | Site color scheme |
| **Typography** | `config/settings_schema.json` | Font settings |
| **Social Links** | `config/settings_schema.json` | Fallback social URLs |

---

## Key JavaScript Files

| File | Purpose | Used In |
|------|---------|---------|
| `assets/admin-profile.js` | Profile tab functionality (Lazy-initialized) | Admin Dashboard |
| `assets/admin-categories.js` | Category/product type management (Lazy-initialized) | Admin Dashboard |
| `assets/header-precision.js` | Header scroll/sticky behavior | All pages |
| `assets/ymm.js` | YMM vehicle search & filtering | Homepage, Collection |
| `assets/cart.js` | Cart functionality | Cart drawer |
| `assets/product-form.js` | Add to cart, variant selection | Product pages |
| `assets/predictive-search.js` | Search autocomplete | Header search |

---

## Category Navigation Bar (YMM Integrated)

**Location:** Inside `header-precision` element (lines 234-362)

### Features:
- **Dynamic Categories** - Fetches product types from `/categories` API with counts
- **Vehicle Badge** - Shows selected vehicle with clear button when YMM active
- **Filtered Counts** - When vehicle selected, shows only categories with matching products
- **Clean URLs** - Uses `/collections/all?type=Exhaust` parameter (no ugly search syntax)
- **Client-Side Filtering** - Collection page JS filters products by `data-product-type` attribute

### URL Parameters:
| Parameter | Purpose | Example |
|-----------|---------|--------|
| `type` | Filter by product type | `/collections/all?type=Exhaust` |
| `filter.p.m.custom.fits_vehicles` | Filter by vehicle | `/collections/all?filter.p.m.custom.fits_vehicles=gid://...` |
| Combined | Both filters | `/collections/all?filter.p.m.custom.fits_vehicles=...&type=Exhaust` |

### Data Flow:
```
1. Page Load → loadCategories() in header-precision.liquid
2. Check localStorage for 'skm_garage_vehicle'
3. Fetch /categories (with vehicleId if vehicle selected)
4. Render category links with counts
5. On click → Navigate to /collections/all?type=CategoryName
6. Collection page JS filters products by data-product-type attribute
```
