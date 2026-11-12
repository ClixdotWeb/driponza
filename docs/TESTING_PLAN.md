# Testing Plan

## Tooling
- **Vitest** for unit tests of pure logic: money, pricing, coupons, shipping zones, status machines, permissions, and file-signature checks.
- **Playwright** (`@playwright/test`) for e2e tests against a local production build (`next build && next start`) and a disposable PostgreSQL database.
- Commands: `npm test` (unit) and `npm run test:e2e` (e2e; needs `DATABASE_URL` pointing at a **test** database).

## Unit coverage targets
`src/lib/money.ts`, `src/server/pricing.ts` (coupons, shipping, COD charge), `src/lib/order-status.ts` (transitions), `src/lib/permissions.ts`, `src/lib/storage.ts#detectImage`.

## E2E journeys
1. Customer: register → search → product → variant → add to cart → update quantity → coupon → address → shipping → bank transfer → place order → submit transfer reference.
2. Admin: sees the order → verifies payment → confirms → packs → creates shipment with tracking → marks delivered.
3. Customer: tracks the order and views it in order history.
4. COD journey, including the PIN restriction.
5. Negative cases:
   - Invalid or expired coupon.
   - Out-of-stock item, and two buyers racing for the last unit.
   - Duplicate submit.
   - A customer opening someone else's order.
   - A non-admin opening `/admin`.
   - A role without permission calling an admin action.
   - An invalid status transition.
   - An upload whose content doesn't match its file type.
6. Returns: request, approve, receive, inspect, refund record.

## Rules
No test result is reported as passing unless it was actually run. Results are recorded in `DEVELOPMENT_PROGRESS.md`.
