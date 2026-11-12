# Missing / Incomplete Features (vs. platform brief)

Priority: P0 blocks launch · P1 needed for operations · P2 improvement.

| # | Feature | Priority | Notes |
|---|---|---|---|
| 1 | Disable Razorpay; manual bank-transfer flow with reference + proof upload + admin verification | P0 | Brief excludes gateways. Keep Razorpay code dormant behind `PAYMENT_GATEWAY_ENABLED` for future use. |
| 2 | Guest checkout | P0 | Orders already allow `userId = null`. Needs guest order-lookup token. |
| 3 | Separate payment-status model (UNPAID … REFUNDED) and extended order statuses with a transition map | P0 | |
| 4 | RBAC: roles, permissions, protected actions, audit log | P0 | |
| 5 | Shipping zones / PIN serviceability / COD rules & charge | P1 | |
| 6 | Inventory: damaged stock, adjustments with reasons, batches/expiry (FEFO), suppliers, purchase entries | P1 | |
| 7 | Shipments with courier/AWB/tracking events, packing slip | P1 | |
| 8 | Cancellations, returns (with photos), refunds (manual bank refund records) | P1 | |
| 9 | Invoices (sequential numbers, PDF/print) | P1 | GSTIN must come from owner |
| 10 | Email verification; notification log + retries | P1 | SMTP credentials needed |
| 11 | Reviews (verified purchase, moderation) | P2 | |
| 12 | Search + shop filters + pagination | P1 | |
| 13 | CMS records (FAQ, pages, recipes) with draft/publish + revisions | P2 | |
| 14 | S3-compatible storage adapter (Coolify MinIO) + `media_assets` | P1 | Needs Coolify MinIO credentials |
| 15 | Coupons: free shipping, first order, product/category scope, usage table | P2 | |
| 16 | Reports: tax, COD, bank-transfer verification, batch expiry, profit (needs cost price) | P2 | |
| 17 | Automated tests in repo (Vitest unit + Playwright e2e) | P0 | |
| 18 | DB-backed rate limiting, security headers | P1 | |
