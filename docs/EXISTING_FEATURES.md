# Existing Features (at baseline `f1645a7`)

Legend: ✅ implemented · 🟡 partial · ❌ missing

| Module | Status | Where |
|---|---|---|
| Homepage (hero carousel, collection, story, pairing guide, FAQ, CTA) | ✅ (content partly hard-coded) | `src/app/(store)/page.tsx`, `src/components/home/*` |
| Shop listing, category filter, sort | 🟡 no price/weight/stock filters, no pagination | `src/app/(store)/shop/page.tsx` |
| Product page, gallery, variant select | 🟡 no zoom, reviews, related, SEO fields | `src/app/(store)/products/[slug]` |
| Search | ❌ | — |
| Cart (guest + user, merge on login) | ✅ | `src/server/cart.ts`, `actions/cart.ts` |
| Wishlist | 🟡 logged-in only | `actions/account.ts` |
| Registration / login / reset | ✅ | `actions/auth.ts` |
| Email verification | ❌ | — |
| Account: orders, addresses | ✅ | `src/app/(store)/account/*` |
| Checkout | 🟡 login required; Razorpay or COD | `CheckoutClient.tsx`, `actions/checkout.ts` |
| Manual bank transfer | ❌ | — |
| COD | 🟡 on/off only; no PIN rules, no charge | `settings.commerce.codEnabled` |
| Coupons | 🟡 % / fixed, limits; no free-shipping/first-order/product scope | `server/orders.ts` |
| Orders + status history | 🟡 10 statuses, no transition rules | `server/orders.ts` |
| Inventory ledger | 🟡 stock + movements; no reserved/damaged/batches | `InventoryMovement` |
| Shipping | 🟡 flat rate + free threshold; single shipment record | `settings.ts`, `Shipment` |
| Returns / refunds | 🟡 Razorpay refunds only | `Refund` |
| Admin dashboard | ✅ real queries | `src/app/admin/page.tsx`, `server/reports.ts` |
| Admin RBAC | ❌ single ADMIN role | — |
| CMS | 🟡 settings JSON (hero text, contact, policies) | `/admin/content` |
| Reviews | ❌ | — |
| Invoices / packing slips | ❌ | — |
| Notifications | 🟡 3 plain-text emails, no log | `lib/email.ts` |
| Reports | 🟡 revenue chart + CSV export | `/admin/reports` |
| Image storage | ✅ Blob/Cloudinary/local; ❌ S3/MinIO | `lib/storage.ts` |
| Health check | ✅ `/api/health` | |
