# Implementation Plan

## Architecture decisions
- **Keep the current stack** (Next.js 16 server actions + Prisma + PostgreSQL). It already meets the brief; no migration.
- **Hosting**: the app and database stay on Vercel + Neon, which are live and working. The Dockerfile remains ready for Coolify. No Coolify server access has been provided, so moving hosting is a business decision, not a code task.
- **Image storage**: add an S3-compatible adapter (MinIO on Coolify). It becomes the active provider automatically once the `S3_*` variables are set. Until then, Vercel Blob stays active so uploads keep working. Every upload is recorded in `MediaAsset`.
- **Payments**: the Razorpay checkout path is disabled (`PAYMENT_GATEWAY_ENABLED` is unset). The code stays dormant as the future gateway interface. Live methods are **manual bank transfer** and **COD**, each toggled in admin settings.
- **APIs**: storefront and admin mutations are server actions with Zod validation and server-side permission checks. Route handlers are added where an HTTP surface is needed: health, cron, CSV/PDF exports, uploads, and the invoice download.

## Phases (status tracked in `/DEVELOPMENT_PROGRESS.md`)
1. Audit and documentation
2. Schema migration `platform_v2` plus permission/role seed
3. Auth: email verification, RBAC guards, audit log, DB rate limiter
4. Catalogue: product fields, categories tree, search, filters, pagination, reviews
5. Storage: S3 adapter, `MediaAsset`, upload validation and processing
6. Cart and wishlist: guest wishlist, sync on login
7. Checkout: guest checkout, shipping zones, COD rules, bank transfer submission
8. Orders: status machine, timeline, notes, bulk actions, export
9. Inventory: adjustments, damaged stock, suppliers, purchases, batches (FEFO), alerts
10. Admin dashboard and RBAC management screens
11. Shipping and tracking events, packing slip
12. Cancellations, returns, refunds
13. CMS: pages, FAQ, revisions
14. Notifications log and templates, invoices
15. Reports
16. Security headers and performance pass
17. Tests: Vitest unit tests and Playwright e2e in the repo
18. Staging deploy (Vercel preview plus a Neon branch)
19. Production readiness review
