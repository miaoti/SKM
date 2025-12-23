Deployment steps:

1. Install Shopify CLI and log in: `shopify login --store <your-store>`
2. Preview theme: `shopify theme dev`
3. Push theme: `shopify theme push` and select theme or provide `--theme` ID.
4. In the YMM page template, set `storefront_access_token` in the section settings with your Headless channel token.
5. Run Admin API mutations:
   - `scripts/vehicle-metaobjects.graphql` to create the `vehicle` definition and seed entries.
   - `scripts/product-metafield-definition.graphql` to add `custom.fits_vehicles` metafield definition (filterable).
6. In Search & Discovery, enable the `custom.fits_vehicles` filter.
7. Test on the live preview: select Year/Make/Model and confirm redirect with filter shows expected products.
