# Database Plan

All changes are **additive migrations**. No table is dropped and no production data is deleted. Enum values are renamed in place (`ALTER TYPE … RENAME VALUE`), which keeps existing rows valid.

Money: stored as `Decimal(10,2)` rupees in order/catalogue tables (existing convention) and integer paise in payment/refund ledgers. All arithmetic in code uses integer paise (`src/lib/money.ts`).

## Changes in migration `platform_v2`

### Auth & RBAC
- `User.emailVerifiedAt`, `User.staffRoleId` → `StaffRole`.
- `StaffRole { id, name, description, permissions String[], isSystem }` — permissions are string keys defined in `src/lib/permissions.ts`. Seeded roles: Super Admin, Store Manager, Order Manager, Inventory Manager, Customer Support, Content Manager, Accountant.
- Data migration: every existing `ADMIN` user gets the Super Admin role.
- `EmailVerificationToken { tokenHash, userId, expiresAt, usedAt }`.
- `AuditLog { actorId, action, entity, entityId, summary, data Json, ip, createdAt }`.
- `RateLimitBucket { key, count, resetAt }` (shared across serverless instances).

### Catalogue
- `Product`: `shortDescription`, `ingredients`, `origin`, `storageInstructions`, `shelfLife`, `hsnCode`, `taxRatePercent`, `seoTitle`, `seoDescription`, `specifications Json`.
- `Category`: `parentId` (self relation), `seoTitle`, `seoDescription`.
- `ProductVariant`: `costPrice` (for profit reports), `damagedStock`.
- `Review { productId, userId, orderId, rating 1–5, title, body, status PENDING|APPROVED|REJECTED, verified }`, unique (userId, productId).

### Inventory
- `InventoryReason` += `DAMAGE`, `PURCHASE`, `RESERVATION_RELEASE`.
- `Supplier { name, phone, email, gstin, address, notes, isActive }`.
- `PurchaseEntry { supplierId, invoiceRef, purchasedAt, notes, createdById }` + `PurchaseEntryItem { variantId, quantity, unitCost, batchId }`.
- `InventoryBatch { variantId, batchNumber, supplierId, purchasedAt, packedAt?, bestBefore?, quantityReceived, quantityRemaining, status ACTIVE|DEPLETED|EXPIRED|DAMAGED }`, unique (variantId, batchNumber).
- `OrderItemBatch { orderItemId, batchId, quantity }` — FEFO allocation for traceability.

### Orders & payments
- `OrderStatus` renamed/added: `PENDING_PAYMENT→AWAITING_PAYMENT`, `PAYMENT_FAILED` kept for legacy rows, new `PENDING, PAYMENT_VERIFICATION, PACKED, READY_TO_SHIP, OUT_FOR_DELIVERY, RETURN_REQUESTED, RETURNED, REFUND_PENDING, DELIVERY_FAILED, RTO`.
- `PaymentStatus` renamed/added: `PENDING→UNPAID`, new `AWAITING_VERIFICATION, PARTIALLY_PAID, REJECTED, REFUND_PENDING`; `NOT_REQUIRED` rows migrated to `UNPAID`.
- `PaymentMethod` += `BANK_TRANSFER` (`RAZORPAY` kept for history; disabled).
- `Order`: `guestAccessTokenHash` (guest order lookup), `codCharge`, `taxTotal`, billing-address snapshot, `invoiceNumber`, `invoicedAt`, `expiresAt` (unpaid bank-transfer hold).
- `BankTransferSubmission { orderId, reference, amountPaise, paidAt, proofAssetId?, status SUBMITTED|VERIFIED|REJECTED, verifiedAmountPaise, bankReference, notes, reviewedById, reviewedAt }`.
- `PaymentTransaction` — immutable ledger: `{ orderId, kind PAYMENT|REFUND|COD_COLLECTION, method, amountPaise, reference, note, recordedById }`.
- `Refund`: `paymentId` nullable; add `orderId`, `method`, `reference`, `returnRequestId`.

### Shipping
- `ShippingZone { name, pincodePrefixes String[], states String[], ratePaise, freeAbovePaise?, codAllowed, codChargePaise, minDays, maxDays, isActive, position }`.
- `Shipment` += `courier`, `awb`, `pickupAt`, `status`, `events ShipmentEvent[]`.
- `ShipmentEvent { shipmentId, status, location, note, occurredAt, createdById }`.

### Returns
- `ReturnRequest { orderId, userId, reason, details, status REQUESTED|APPROVED|REJECTED|RECEIVED|INSPECTED|REFUNDED|CLOSED, resolutionNote, imageUrls String[] }` + `ReturnItem { returnRequestId, orderItemId, quantity, condition RESELLABLE|DAMAGED|null }`.

### Coupons
- `DiscountType` += `FREE_SHIPPING`. `Coupon` += `firstOrderOnly`, `productIds String[]`, `categoryIds String[]`.
- `CouponUsage { couponId, orderId unique, userId?, email }`.

### CMS, media, notifications, support
- `MediaAsset { key, url, provider, mime, sizeBytes, width, height, alt, folder, createdById }`.
- `ContentPage { slug, title, body, status DRAFT|PUBLISHED, publishedAt, seoTitle, seoDescription }` + `ContentRevision`.
- `FaqItem { question, answer, position, isPublished }`.
- `NotificationLog { channel, to, template, subject, status QUEUED|SENT|FAILED|SKIPPED, error, attempts, dedupeKey unique, orderId? }`.
- `SupportTicket { userId?, email, name, subject, message, orderNumber?, status OPEN|PENDING|CLOSED }`.

## Stock rules (exact)
1. **At order placement (all payment methods)** stock is decremented atomically with `UPDATE … WHERE stock >= qty` inside the order transaction (a *reservation*). An `InventoryMovement` (`SALE`) is written once — `Order.stockApplied` guards against double deduction.
2. **Bank transfer, unpaid**: the reservation holds for `commerce.bankTransferHoldHours` (default 48h). Expired unpaid orders are cancelled by `/api/cron/expire-orders` and stock is restored (`RESERVATION_RELEASE`).
3. **Payment verified** by an admin: no stock change (already reserved).
4. **COD**: reserved at placement; on delivery the COD collection is recorded; on RTO stock is restored after inspection.
5. **Cancellation before shipment**: stock restored (`CANCELLATION`).
6. **Return**: stock restored only after inspection marks the item `RESELLABLE` (`RETURN`); `DAMAGED` items increase `damagedStock` instead.
7. Batches: allocation FEFO (earliest best-before, then earliest purchase) when a batch-tracked variant ships; unbatched stock remains allowed.
