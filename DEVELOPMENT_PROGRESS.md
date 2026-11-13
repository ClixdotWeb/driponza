# Development Progress

Last updated: 2026-11-13 · Branch: `master` (local git) · Production: live (see "Deployment status").

## Phase status

| # | Phase | Status | Notes |
|---|---|---|---|
| 1 | Audit & documentation | ✅ Done | `docs/*` |
| 2 | Database schema & migrations | ✅ Done | `20261112100000_platform_v2`, `20261112110000_invoice_sequence` – additive; legacy enum values mapped |
| 3 | Auth, customers, RBAC | ✅ Done | Email verification, password confirm, session revocation on password change, 7 system roles + custom roles, audit log, DB rate limiter |
| 4 | Products, categories, search | 🟡 Mostly | SKU search, price/pack-size/stock filters, best-selling & popularity sort, pagination, reviews. **Not yet:** product form fields for ingredients/origin/shelf life/HSN/GST %/SEO (columns exist), image zoom, category tree UI, product CSV import, duplicate product |
| 5 | Storage | ✅ Done (code) | S3/MinIO adapter, sharp re-encode (EXIF strip, WebP, size caps), `MediaAsset`, private files, reference-safe deletion. **Needs owner:** Coolify MinIO credentials |
| 6 | Cart & wishlist | 🟡 | Cart unchanged (works). **Guest wishlist not implemented** (wishlist requires sign-in) |
| 7 | Checkout & manual payments | ✅ Done | Guest checkout, PIN serviceability, zones, COD rules/charge, bank-transfer reference + proof, server re-pricing, duplicate-submit guard |
| 8 | Order management | ✅ Done | 20-status machine with server-enforced transitions, timeline, notes, bulk updates, CSV export, packing slip |
| 9 | Inventory & batches | ✅ Done | Reservation at placement, auto-release of expired unpaid orders, damaged stock, suppliers, purchases → batches (FEFO allocation), write-offs, CSV import/export |
| 10 | Admin dashboard & RBAC | ✅ Done | Redesigned shell; live metrics with date range; permission-filtered nav |
| 11 | Shipping & tracking | ✅ Done (manual) | Zones, courier/AWB, tracking events, public `/track`. Courier API: not integrated |
| 12 | Returns, cancellations, refunds | ✅ Done | Inspection-gated restock, refunds need a bank reference to count as sent |
| 13 | CMS | 🟡 | Hero/brand text, contact, policies, featured products, FAQ (DB). **Not yet:** recipes, content pages with draft/preview/revisions UI (tables exist) |
| 14 | Notifications & invoices | ✅ Done | Notification log with dedupe + cron retry; PDF invoices (sequential numbers); verification emails. **Needs owner:** SMTP |
| 15 | Reports | ✅ Done | 16 reports + CSV |
| 16 | Security & performance | ✅ Done | Security headers, no-store on personal pages, signature+re-encode uploads, CSRF origin check on upload route |
| 17 | Testing | ✅ Done | Unit 28/28, e2e 9/9 (see below) |
| 18 | Staging deployment | ⏭ Skipped | Owner approved direct production deploy; tested on a local production build instead |
| 19 | Production readiness review | ⏳ Pending | Blocked on owner configuration (below) |

## Tests executed (2026-11-13, local production build + local PostgreSQL)

- `npm run typecheck` – 0 errors
- `npm test` (Vitest) – **28 passed**: coupons (%, fixed, caps, expiry, limits, first-order, scoped, free shipping), zone matching, totals/COD/GST, status transitions, payment-status maths, permissions, CSV injection/parsing, money
- `npm run test:e2e` (Playwright) – **9 passed**:
  1. Register → search → product → qty → expired coupon rejected → valid coupon → PIN zone → bank transfer → order → submit UTR
  2. Duplicate submission impossible (cart claimed)
  3. Support role blocked from payment verification
  4. Admin verifies transfer → confirmed → packed → shipment/AWB → shipped → out for delivery → delivered
  5. Customer sees tracking, downloads PDF invoice (stranger gets 404), requests return
  6. Admin approves → receives → inspects (resellable) → stock movement recorded
  7. Guest COD: PIN without COD shows reason; COD charge applied; guest link 404 for others
  8. Customer can't open admin / other orders; private media, cron and exports refuse
  9. Two buyers race for the last unit → exactly one order

### Bugs found and fixed by testing
- Admin layout crashed (500) – nav list imported from a client module into a server component.
- Sold-out item at checkout produced a misleading "Your cart is empty".
- Return status sentence read "Your return request is requested".

## Configuration still required from the business owner
1. **Bank account** for transfers (Admin → Settings) and enable bank transfer.
2. **COD decision** – on/off, charge, limit, which PINs (Admin → Shipping).
3. **Shipping rates/zones** (Admin → Shipping).
4. **SMTP credentials** (`SMTP_*`, `MAIL_FROM`, `ADMIN_NOTIFY_EMAIL`) – until then no email is sent.
5. **Coolify MinIO** (`S3_*`) – until then Vercel Blob stays the image store.
6. **GSTIN / legal name / HSN & GST % per product** if GST-registered.
7. **Policies** (privacy, terms, shipping, returns) and return window.
8. **Real stock** (all variants are 0 in production).
9. `CRON_SECRET` on Vercel.

## Deployment status
**Live on https://driponza.vercel.app since 2026-11-13** (deployment driponza-i7l2m6qsp).
- Pre-migration data backup: `backups/prod-2026-11-13T05-43-54-332Z.json` (local, git-ignored; 8 products, 1 admin, 0 orders).
- Production migrations applied: `platform_v2`, `invoice_sequence`; schema drift check empty; existing admin = Super Admin.
- `CRON_SECRET` set; cron runs daily (Hobby plan limit) + opportunistic expiry from checkout/admin.
- Live smoke test: health OK, storefront pages 200, cron/private media/exports refuse, /admin redirects to login, no browser errors.
- Checkout shows "ordering opens soon" until bank details or COD are enabled in Admin → Settings.

## Known gaps / next work
Product form extra fields & SEO, guest wishlist, recipes & content pages with revisions UI, product CSV import/duplicate, image zoom, notification template editor, Argon2id (bcrypt in use), staging environment.
