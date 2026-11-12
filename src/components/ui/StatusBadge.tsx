import { cn, ORDER_STATUS_LABEL, PAYMENT_STATUS_LABEL } from "@/lib/utils";

const NEUTRAL = "bg-cream-100 text-ink-700";
const GOOD = "bg-botanical-100 text-green-600";
const PROGRESS = "bg-botanical-100 text-forest-800";
const TRANSIT = "bg-[#e3eefa] text-[#1f5a96]";
const WARN = "bg-[#fbefd6] text-[#8a5a00]";
const BAD = "bg-danger-600/10 text-danger-600";
const DONE = "bg-forest-800 text-ivory-50";
const MUTED = "bg-cream-200 text-ink-700";

const ORDER_TONE: Record<string, string> = {
  PENDING: NEUTRAL,
  AWAITING_PAYMENT: NEUTRAL,
  PAYMENT_VERIFICATION: WARN,
  CONFIRMED: GOOD,
  PROCESSING: PROGRESS,
  PACKED: PROGRESS,
  READY_TO_SHIP: PROGRESS,
  SHIPPED: TRANSIT,
  OUT_FOR_DELIVERY: TRANSIT,
  DELIVERED: DONE,
  ON_HOLD: WARN,
  CANCEL_REQUESTED: WARN,
  CANCELLED: BAD,
  RETURN_REQUESTED: WARN,
  RETURNED: MUTED,
  REFUND_PENDING: WARN,
  REFUNDED: MUTED,
  DELIVERY_FAILED: BAD,
  RTO: BAD,
  PAYMENT_FAILED: BAD,
};
const PAY_TONE: Record<string, string> = {
  UNPAID: NEUTRAL,
  AWAITING_VERIFICATION: WARN,
  PARTIALLY_PAID: WARN,
  PAID: GOOD,
  FAILED: BAD,
  REJECTED: BAD,
  REFUND_PENDING: WARN,
  PARTIALLY_REFUNDED: MUTED,
  REFUNDED: MUTED,
};

export function OrderStatusBadge({ status }: { status: string }) {
  return <span className={cn("inline-flex rounded-full px-2.5 py-1 text-[11px] font-medium", ORDER_TONE[status] ?? NEUTRAL)}>{ORDER_STATUS_LABEL[status as keyof typeof ORDER_STATUS_LABEL] ?? status}</span>;
}

export function PaymentStatusBadge({ status }: { status: string }) {
  return <span className={cn("inline-flex rounded-full px-2.5 py-1 text-[11px] font-medium", PAY_TONE[status] ?? NEUTRAL)}>{PAYMENT_STATUS_LABEL[status as keyof typeof PAYMENT_STATUS_LABEL] ?? status}</span>;
}
