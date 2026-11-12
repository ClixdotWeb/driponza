# Driponza — Project Audit

Audit date: 2026-11-12. Baseline commit: `f1645a7` (local git repository created during this audit — the project previously had **no version control**).

## 1. Stack (verified from `package.json` and source)

| Area | In use | Notes |
|---|---|---|
| Framework | Next.js 16.4.6 (App Router), React 19.3 | `src/proxy.ts` replaces `middleware.ts` in this Next version |
| Language | TypeScript 6.0.3 (strict) | `npm run typecheck` passes |
| Styling | Tailwind CSS 4.3 (`@theme` tokens in `src/app/globals.css`) | Fonts: Instrument Serif, Inter, Pinyon Script |
| Animation | GSAP 3.15 + `@gsap/react` | Hero + closing CTA text animation only |
| Database | PostgreSQL via Prisma 7.10.1 + `@prisma/adapter-pg` | Client generated to `src/generated/prisma`; one migration (`20261111132752_init`) |
| Validation | Zod 4.6 | Server-side in actions |
| Auth | Custom DB sessions (HMAC-hashed token in `dz_session` cookie), bcryptjs passwords | Roles: `CUSTOMER`, `ADMIN` only |
| Payments | Razorpay SDK (orders, signature verification, webhook) | **Out of scope per new brief — must be disabled** |
| Storage | Vercel Blob (live) → Cloudinary → local disk fallback | No S3/MinIO adapter |
| Email | Nodemailer SMTP; logs instead of sending when `SMTP_HOST` unset | Not configured in production |
| Hosting | Vercel project `driponza` (https://driponza.vercel.app), Neon Postgres, Vercel Blob store `driponza-images` | `Dockerfile` kept for Coolify |
| Tests | None in the repository | 63 Playwright e2e checks existed only in a temporary scratch folder |
| Lint | No ESLint config | `next lint` was removed in Next 16; nothing configured |

## 2. Route inventory

Storefront (`src/app/(store)`): `/`, `/shop`, `/products/[slug]`, `/cart`, `/checkout`, `/wishlist`, `/login`, `/register`, `/forgot-password`, `/reset-password`, `/account`, `/account/orders`, `/account/orders/[number]`, `/account/addresses`, `/our-story`, `/contact`, `/policies/[slug]`.

Admin (`src/app/admin`): dashboard, products (list/new/edit), categories, inventory, orders (list/detail), payments, customers, coupons, content (settings/CMS), reports.

API: `/api/health`, `/api/admin/upload`, `/api/admin/reports/export`, `/api/webhooks/razorpay`, `/media/[...path]` (local uploads).

## 3. Findings

### Working and verified previously (e2e in scratch, Nov 2026)
Registration/login/logout/password reset (token flow), DB cart for guests + users, wishlist (logged-in), coupon validation, checkout with saved addresses, COD order creation, Razorpay order + signature + webhook (idempotent via `PaymentEvent.eventId`), atomic stock decrement with `InventoryMovement` ledger, admin product/variant/image CRUD, order status changes with history, CSV report export.

### Bugs / weaknesses
1. **No version control** — fixed by initialising git (local only).
2. **Payment flow depends on Razorpay**, which the brief excludes. Non-COD checkout currently cannot complete without Razorpay keys.
3. **Guest checkout not supported** — `placeOrderAction` requires login.
4. **Single admin role** — any `ADMIN` can do everything; no permission granularity, no audit log.
5. **Rate limiter is in-memory** — on Vercel each serverless instance has its own memory, so limits are per-instance (weak). Needs DB-backed buckets.
6. **No email verification** for new accounts.
7. **Order/payment status model** lacks bank-transfer verification, packing, out-for-delivery, returns, RTO.
8. **No batch/expiry, suppliers, purchase entries, shipping zones, returns, reviews, invoices, notification log.**
9. **CMS is a single settings blob** — no FAQ/page records, no draft/publish, no revisions.
10. **Storage**: no S3-compatible adapter; image metadata stored only as URL on `ProductImage` (no `media_assets`).
11. **No automated tests in the repo; no lint config.**
12. **Live data**: every variant has stock 0 (source site published no stock numbers), so all products show "Out of stock".
13. Policies (privacy/terms/shipping/returns) are empty — the business must supply text.

### Security review (current state)
- ✅ Passwords: bcrypt (cost 12). Argon2id requested by brief — bcrypt is an accepted alternative; switching would need rehash-on-login (planned, low priority).
- ✅ Session tokens hashed at rest; httpOnly, `secure` in production, `sameSite=lax`.
- ✅ Server actions re-check auth; admin layout checks role server-side.
- ✅ Prices/discounts recalculated server-side; uploads validated by file signature.
- ⚠️ Rate limiting per-instance only (see 5).
- ⚠️ No audit log of admin actions.
- ⚠️ No CSP / security headers configured in `next.config.ts`.

### Production risks
- Business details not yet confirmed: GSTIN, bank account for transfers, return policy, shipping rates.
- SMTP not configured → customers receive no emails.
- Vercel Blob is the active image store; the brief mandates Coolify MinIO, which does not yet exist (no Coolify access has been provided).
