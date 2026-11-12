// Pure order/payment status rules – shared by server code, admin UI and unit tests.
import type { OrderStatus, PaymentStatus } from "@/generated/prisma/enums";

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  PENDING: "Pending",
  AWAITING_PAYMENT: "Awaiting payment",
  PAYMENT_VERIFICATION: "Payment verification",
  CONFIRMED: "Confirmed",
  PROCESSING: "Processing",
  PACKED: "Packed",
  READY_TO_SHIP: "Ready for shipment",
  SHIPPED: "Shipped",
  OUT_FOR_DELIVERY: "Out for delivery",
  DELIVERED: "Delivered",
  ON_HOLD: "On hold",
  CANCEL_REQUESTED: "Cancellation requested",
  CANCELLED: "Cancelled",
  RETURN_REQUESTED: "Return requested",
  RETURNED: "Returned",
  REFUND_PENDING: "Refund pending",
  REFUNDED: "Refunded",
  DELIVERY_FAILED: "Failed delivery",
  RTO: "Return to origin",
  PAYMENT_FAILED: "Payment failed",
};

export const PAYMENT_STATUS_LABEL: Record<PaymentStatus, string> = {
  UNPAID: "Unpaid",
  AWAITING_VERIFICATION: "Awaiting verification",
  PARTIALLY_PAID: "Partially paid",
  PAID: "Paid",
  FAILED: "Failed",
  REJECTED: "Rejected",
  REFUND_PENDING: "Refund pending",
  PARTIALLY_REFUNDED: "Partially refunded",
  REFUNDED: "Refunded",
};

/**
 * Allowed manual/automatic order transitions. Anything not listed is rejected.
 * Payment-driven moves (AWAITING_PAYMENT → PAYMENT_VERIFICATION → CONFIRMED) are included so the
 * same guard protects automated code paths.
 */
export const ORDER_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  PENDING: ["AWAITING_PAYMENT", "CONFIRMED", "CANCELLED", "ON_HOLD"],
  AWAITING_PAYMENT: ["PAYMENT_VERIFICATION", "CONFIRMED", "CANCELLED", "ON_HOLD"],
  PAYMENT_VERIFICATION: ["CONFIRMED", "AWAITING_PAYMENT", "CANCELLED", "ON_HOLD"],
  CONFIRMED: ["PROCESSING", "PACKED", "CANCEL_REQUESTED", "CANCELLED", "ON_HOLD"],
  PROCESSING: ["PACKED", "CANCEL_REQUESTED", "CANCELLED", "ON_HOLD"],
  PACKED: ["READY_TO_SHIP", "SHIPPED", "CANCELLED", "ON_HOLD"],
  READY_TO_SHIP: ["SHIPPED", "CANCELLED", "ON_HOLD"],
  SHIPPED: ["OUT_FOR_DELIVERY", "DELIVERED", "DELIVERY_FAILED", "RTO"],
  OUT_FOR_DELIVERY: ["DELIVERED", "DELIVERY_FAILED", "RTO"],
  DELIVERY_FAILED: ["OUT_FOR_DELIVERY", "SHIPPED", "RTO", "DELIVERED"],
  RTO: ["RETURNED", "REFUND_PENDING", "CANCELLED"],
  DELIVERED: ["RETURN_REQUESTED"],
  RETURN_REQUESTED: ["RETURNED", "DELIVERED", "REFUND_PENDING"],
  RETURNED: ["REFUND_PENDING", "REFUNDED"],
  REFUND_PENDING: ["REFUNDED"],
  REFUNDED: [],
  CANCEL_REQUESTED: ["CANCELLED", "CONFIRMED", "PROCESSING"],
  CANCELLED: ["REFUND_PENDING", "REFUNDED"],
  ON_HOLD: ["AWAITING_PAYMENT", "PAYMENT_VERIFICATION", "CONFIRMED", "PROCESSING", "PACKED", "CANCELLED", "REFUND_PENDING"],
  PAYMENT_FAILED: ["AWAITING_PAYMENT", "CANCELLED"],
};

export function canTransition(from: OrderStatus, to: OrderStatus) {
  return from !== to && ORDER_TRANSITIONS[from].includes(to);
}

/** Statuses where goods have not left the warehouse – stock can simply be restored on cancel. */
export const PRE_SHIPMENT: readonly OrderStatus[] = [
  "PENDING", "AWAITING_PAYMENT", "PAYMENT_VERIFICATION", "CONFIRMED", "PROCESSING", "PACKED", "READY_TO_SHIP", "ON_HOLD", "CANCEL_REQUESTED", "PAYMENT_FAILED",
];

/** Fulfilment steps that require the order to be paid (bank transfer) – COD may proceed unpaid. */
export const REQUIRES_PAYMENT: readonly OrderStatus[] = ["CONFIRMED", "PROCESSING", "PACKED", "READY_TO_SHIP", "SHIPPED", "OUT_FOR_DELIVERY", "DELIVERED"];

/** Customer may cancel directly (no approval) before the order is being prepared. */
export const CUSTOMER_CAN_CANCEL: readonly OrderStatus[] = ["PENDING", "AWAITING_PAYMENT", "PAYMENT_VERIFICATION", "PAYMENT_FAILED"];
/** Customer may request cancellation (needs staff approval). */
export const CUSTOMER_CAN_REQUEST_CANCEL: readonly OrderStatus[] = ["CONFIRMED", "PROCESSING"];

export function paymentStatusAfterReceipt(totalPaise: number, paidPaise: number): PaymentStatus {
  if (paidPaise <= 0) return "UNPAID";
  return paidPaise >= totalPaise ? "PAID" : "PARTIALLY_PAID";
}

export function paymentStatusAfterRefund(paidPaise: number, refundedPaise: number): PaymentStatus {
  if (refundedPaise <= 0) return "PAID";
  return refundedPaise >= paidPaise ? "REFUNDED" : "PARTIALLY_REFUNDED";
}
