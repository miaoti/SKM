## Overview

* Build a native, high-performance YMM (Year/Make/Model) search using Metaobjects and product metafields. No paid apps.

* Implement a premium, red/white UI on top of a stripped Dawn base with performance-first techniques.

* Prepare clean integration points for future Shopmonkey middleware.

* Deploy via Shopify CLI with proper access scopes and storefront filters enabled.

## Data Model (Admin API)

* Metaobject Definition: `vehicle`

  * Fields: `year` (integer), `make` (single-line text), `model` (single-line text), `submodel` (single-line text, optional), `engine` (single-line text, optional)

  * Capabilities: `admin`, `storefront_renderable` (optional if you want direct views)

* Product Metafield: `custom.fits_vehicles` (type: `list.metaobject_reference`, reference type: `vehicle`)

  * Enable “Storefront filtering” on this metafield definition so collections can be filtered by selected vehicle.

* Example Admin GraphQL mutations (run once):

  * Create definition: `metaobjectDefinitionCreate` with fields above.

  * Create product metafield definition: `metafieldDefinitionCreate` for `custom.fits_vehicles` with `visibleToStorefront` and `filterableInStorefront` enabled.

  * Seed vehicles: `metaobjectCreate` per vehicle entry, then attach to products with `productUpdate` using list of metaobject reference GIDs.

## Access & Scopes

* Storefront API: enable `unauthenticated_read_metaobjects` scope (Headless channel) to query `metaobjects` on the storefront.

* Theme app extensions not required; we consume Storefront API from the theme with secure public token.

## Frontend Architecture

* Base: latest Dawn, prune unused sections/snippets and re-style.

* New Section: `sections/ymm-search.liquid`

  * Presents cascading selects: Year → Make → Model → (Submodel/Engine optional, shown if present).

  * Uses minimal DOM, generous whitespace, large type, and premium micro-interactions.

* Assets:

  * `assets/ymm.css`: CSS variables for palette and typography; optional Tailwind if pipeline already configured.

  * `assets/ymm.js`: Data fetching, caching, dropdown logic, and redirect.

* JSON Template:

  * `templates/page.ymm.json`: OS 2.0 JSON adds the `ymm-search` section so you can route a dedicated YMM landing.

## Storefront Data Fetching

* GraphQL query: `metaobjects(type: "vehicle", first: N, after: cursor)` returning `fields { key, value }`, `handle`, `id`.

* Strategy:

  * Lazy-load and cache. First request pulls unique `year` values; on selection, fetch/paginate to index `make` by `year`, then `model` by `year+make`.

  * Client-side indexing minimizes network and avoids loading the full dataset at once.

  * `localStorage` cache keyed by dataset version (e.g., `vehicles_index_v1`).

* Resilience: fall back to paginated full pull if the dataset is small; throttle and dedupe requests.

## Cascading Dropdown Logic

* Year select: built from deduped `vehicle.fields.year`.

* Make select: filtered list where `year` matches selection.

* Model select: filtered by `year` + `make`.

* Submodel/Engine: only render if present in filtered entries.

* Selected vehicle resolution: pick the exact `vehicle` metaobject entry matching the chosen attributes; capture its `id` (GID).

## Redirect to Collection with Native Filter

* Build URL: `/{collection-handle}?filter.v.m.custom.fits_vehicles={vehicle_gid}`

  * For list of metaobject references, storefront filters match items containing the chosen GID.

  * Default collection: `collections/all` unless a dedicated collection is provided.

* Optional: preselect filters UI state by reading URL params so the customer can refine further.

## Styling & Premium UI

* CSS variables:

  * `--brand-red`, `--brand-white`, `--brand-black`, `--brand-gray`

  * Type scale with fluid clamp values; tracking tightened for headings.

* Layout:

  * Wide, centered module with large label/inputs; focus states with subtle red glow.

  * High-res hero image preloaded; large CTA “Find Exhausts”.

* Micro-interactions: smooth transitions, inert states while loading, distinct hover/active states.

* If Tailwind is present: use utility classes with `@layer` for tokens; otherwise keep pure CSS.

## Performance (LCP-first)

* Preload hero image and critical font.

* Inline critical CSS for YMM fold; defer non-critical CSS.

* Storefront requests batched and paginated; memoize transformations.

* Use `requestIdleCallback` for indexing; `AbortController` for canceled queries.

## Accessibility

* Labels and `aria-describedby` for selects; WCAG AA color contrast.

* Keyboard navigation support; visible focus rings.

* Live region (`aria-live=polite`) for loading state updates.

## Theme Integration (OS 2.0 JSON)

* Add `ymm-search` section schema with settings:

  * `collection_handle` (destination), `show_submodel`, `show_engine`, content blocks for copy.

* Add to `page.ymm.json` template; expose in customizer.

* Wire `assets/ymm.js` via the section, scoped to section container.

## Search & Discovery Setup

* In Shopify Admin → Search & Discovery:

  * Add `custom.fits_vehicles` as an available filter on collections.

  * Ensure it appears in `facets` so native filter can be driven by URL param.

## Validation & QA

* Seed sample entries for 3–5 vehicles and 6–8 products.

* Test cascade correctness, caching, pagination, and redirect.

* Verify collection filtering returns expected SKUs and that the facet shows the selected vehicle.

* Mobile and desktop LCP measurement; fix regressions.

## Shopmonkey Future Hooks

* Add clearly marked TODO anchors in `assets/ymm.js` and relevant product/Cart UI:

  * `// SHOPMONKEY: inventory-sync hook` near inventory badges.

  * `// SHOPMONKEY: invoice middleware` near checkout initiation.

* Keep data adapters modular so replacing product availability source is trivial.

## Deployment (Push to Shopify)

* Shopify CLI: `shopify theme dev` for live preview, then `shopify theme push` once approved.

* Admin API runs to create metaobject definition, product metafield definition, and seed data.

* Verify storefront filter in live theme, then publish.

## Deliverables

* `sections/ymm-search.liquid`, `templates/page.ymm.json`

* `assets/ymm.css`, `assets/ymm.js`

* Admin API scripts/snippets to create definitions and seed entries

* Documentation: how to add vehicles and attach products, and how filters/redirects are formed

## Next Step

* On approval, I’ll implement the section, assets, Admin API setup, seed test data, and push to Shopify, then verify filters and performance end-to-end.

