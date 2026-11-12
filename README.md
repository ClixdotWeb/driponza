# Driponza — Pure Spices. Bold Flavour.

Full-stack e-commerce platform for Driponza: storefront, customer accounts, cart, checkout with Razorpay, order management and an admin dashboard.

**Stack:** Next.js 16 (App Router, TypeScript) · Tailwind CSS 4 · GSAP 3 · PostgreSQL + Prisma 7 · Zod · Razorpay · Cloudinary (optional) · Nodemailer (SMTP)

---

## Deploying on Vercel (current live site)

Live: **https://driponza.vercel.app** · project `driponza` (team “muhamed safeer’s projects”).

- Database: **Neon Postgres** (Vercel Marketplace) — `DATABASE_URL` / `DATABASE_URL_UNPOOLED` are set by the integration.
- Images uploaded in the admin: **Vercel Blob** store `driponza-images` — `BLOB_READ_WRITE_TOKEN` is set automatically.
- Also set: `SESSION_SECRET`, `APP_URL=https://driponza.vercel.app`. Add Razorpay / SMTP keys under *Settings → Environment Variables*, then redeploy.
- Deploy: `npx vercel deploy --prod`. Migrations are **not** run on Vercel builds — after a schema change run `npx prisma migrate deploy` with `DATABASE_URL` set to the *unpooled* Neon URL.
- `.vercel/.env.vercel` (git-ignored) holds the pulled production variables; never commit it.
- Rate limiting is in-memory, so on serverless it is per-instance (best effort).

## Deploying on Coolify (alternative)

1. **Database** — in Coolify create a **PostgreSQL** resource. Copy its *internal* connection URL.
2. **Application** — add this repository as a new resource using the **Dockerfile** build pack. Port: `3000`.
3. **Environment variables** (Application → Environment Variables) — see `.env.example`. Minimum:
   | Variable | Value |
   |---|---|
   | `DATABASE_URL` | internal Postgres URL from step 1 |
   | `APP_URL` | your public URL, e.g. `https://driponza.com` (no trailing slash) |
   | `SESSION_SECRET` | 48+ random characters: `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"` |
4. **Persistent storage** — add a volume mounted at `/app/uploads` (product images uploaded from the admin). Skip only if you configure Cloudinary.
5. **Deploy.** Database migrations run automatically every time the container starts.
6. **One-time setup** — open the application's **Terminal** in Coolify and run:
   ```sh
   npm run db:seed                                   # imports the 8 products from driponza.xyz
   npm run admin:create -- you@example.com "Your Name" "a-strong-password"
   ```
7. Sign in at `/login` with the admin account → you land on `/admin`. Work through the **Store setup** checklist on the dashboard.

Health check endpoint: `GET /api/health` (used by the Docker `HEALTHCHECK`).

### Razorpay (awaiting credentials)
Online payment is fully implemented but switched off until keys are set. Checkout shows "awaiting Razorpay credentials" until then.

1. Razorpay Dashboard → *Settings → API Keys* → set `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` (start with `rzp_test_` keys).
2. *Settings → Webhooks* → URL `{APP_URL}/api/webhooks/razorpay`, events `payment.captured`, `payment.failed`, `order.paid`, `refund.created`, `refund.processed`, `refund.failed` → copy the secret into `RAZORPAY_WEBHOOK_SECRET`.
3. Redeploy, place a test order, and check *Admin → Payments*.

How payments are trusted:
- The order and Razorpay order are created **server-side** with server-calculated prices.
- A payment is accepted only after (a) the checkout signature is verified **and** the payment is fetched from the Razorpay API, or (b) a webhook with a valid HMAC signature arrives.
- Webhooks are de-duplicated by event id; marking an order paid and reducing stock is idempotent. Amount mismatches put the order **on hold** instead of marking it paid.
- Refunds are issued through the Razorpay API from *Admin → Orders → Refund* and recorded once even if the webhook also reports them.

### Email (awaiting credentials)
Set `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `MAIL_FROM` for password-reset and order emails. Without SMTP, emails are written to the server log instead (so password reset will not reach customers).

### Images
Without Cloudinary, uploads are stored in `UPLOAD_DIR` (`/app/uploads`) and served from `/media/…`. Set the three `CLOUDINARY_*` variables to store them on Cloudinary instead. Uploads are checked by file signature (JPEG/PNG/WebP/AVIF, ≤ 8 MB) — the browser's MIME type is not trusted.

---

## Local development

```sh
npm install
cp .env.example .env          # point DATABASE_URL at a local Postgres
npx prisma migrate dev
npm run db:seed
npm run admin:create -- admin@example.com "Admin" "change-me-please"
npm run dev
```

Other scripts: `npm run typecheck`, `npm run brand:assets` (regenerates the recoloured logo, icons and optimised product photos from `_source/`).

## Project structure

```
prisma/              schema, migrations, seed (imports _source/catalogue.json)
_source/             snapshot of driponza.xyz taken 11 Nov 2026: catalogue JSON, original images, old page
public/brand, images logo variants + product photos used by the seed
src/app/(store)      storefront: home, shop, product, cart, checkout, account, wishlist, auth, policies
src/app/admin        admin dashboard (ADMIN role only, enforced server-side in the layout and every action)
src/app/api          Razorpay webhook, admin upload, CSV export, health
src/server           catalogue queries, cart, orders/payments/inventory logic, server actions
src/lib              db, auth/session, settings, money, storage, email, razorpay, rate-limit, gsap
src/components       home sections, store UI, admin UI, SVG spice illustrations
```

## Data notes (from the source site)

- 8 products were imported, all **Whole Spices**, one weight each. Prices: `offerPrice` became the selling price and the original price is shown as MRP.
- The source had **no stock figures** — imported variants start at `SEED_STOCK` (default 0, shown as out of stock). Enter real stock in *Admin → Inventory*.
- Every imported product is flagged **Needs review**. Specific notes: “Way Leaf” is probably “Bay Leaf”; Nutmeg ₹60 and Black Pepper ₹590 per 100 g look unusual.
- “Spice Powders” exists as a category (it was a filter on the old site) but stays hidden until it has products.
- Shipping defaults to ₹0 and COD is off until set in *Admin → Content & settings*. Policy pages show a placeholder until their text is added there.
- The floating spices on the homepage are original SVG illustrations. They can be replaced with real cut-out photography later.

## Security summary

bcrypt password hashing · DB-backed sessions (HMAC-hashed tokens, httpOnly/secure/sameSite cookies) · role checks on every admin page, action and route · Zod validation on all inputs · Prisma (parameterised SQL) · Server Actions' origin check + explicit origin check on the upload route · in-memory rate limiting on auth, cart, coupon, checkout and newsletter (single instance; use Redis if you scale out) · security headers (frame-ancestors, HSTS, nosniff…) · CSV export guarded against formula injection · no card data stored.
