# BeeBazar Storefront

A polished, mobile-first Bangla e-commerce frontend for BeeBazar—custom apparel, print products, gifts, accessories, and event kits.

## Run locally

```bash
npm install
npm run dev
```

Production check:

```bash
npm run build
npm run preview
```

## Main routes

- `/` — Homepage
- `/shop` — Product catalogue, search, category and price filters
- `/product/honey-drop-hoodie` — Example product details
- `/customize` — Live product playground and custom-order brief
- `/checkout` — Checkout and simulated order confirmation

## Working frontend features

- Responsive desktop/mobile navigation
- Product search, category filters, sorting, wishlist
- Product variants, colors, quantity and wholesale price tiers
- Persistent localStorage cart and wishlist
- Cart drawer with quantity management and free-delivery progress
- Product details and related products
- Live SVG customization preview
- Three-step custom-order brief
- Delivery and payment selection
- Validated checkout and order-success flow
- Friendly login/register demo, FAQ and support widget
- Motion with reduced-motion accessibility support

## Content changes

Product, category, review and FAQ content lives in:

```text
src/data.js
```

Brand colors and layout tokens begin at the top of:

```text
src/styles.css
```

## Important

This version is a high-fidelity **frontend MVP**. Payment, authentication, inventory, file upload, order persistence, SMS/email and admin operations are simulated UI flows. Connect them to a secure backend and a licensed payment provider before accepting real orders.

## Visual assets

The primary hero, print, gift and hoodie product visuals were generated specifically for this prototype. A few supporting lifestyle thumbnails are local prototype assets sourced via Pexels/image search and should be reviewed or replaced with BeeBazar's own final product photography before commercial launch.
