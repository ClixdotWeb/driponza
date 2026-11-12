import { cn, ORDER_STATUS_LABEL, PAYMENT_STATUS_LABEL } from "@/lib/utils";

const ORDER_TONE: Record<string, string> = {
  PENDING_PAYMENT: "bg-cream-100 text-ink-700",
  CONFIRMED: "bg-botanical-100 text-green-600",
  PROCESSING: "bg-botanical-100 text-forest-800",
  SHIPPED: "bg-[#e3eefa] text-[#1f5a96]",
  DELIVERED: "bg-forest-800 text-ivory-50",
  ON_HOLD: "bg-[#fbefd6] text-[#8a5a00]",
  CANCEL_REQUESTED: "bg-[#fbefd6] text-[#8a5a00]",
  CANCELLED: "bg-danger-600/10 text-danger-600",
  PAYMENT_FAILED: "bg-danger-600/10 text-danger-600",
  REFUNDED: "bg-cream-200 text-ink-700",
};
const PAY_TONE: Record<string, string> = {
  PENDING: "bg-cream-100 text-ink-700",
  PAID: "bg-botanical-100 text-green-600",
  FAILED: "bg-danger-600/10 text-danger-600",
  REFUNDED: "bg-cream-200 text-ink-700",
  PARTIALLY_REFUNDED: "bg-cream-200 text-ink-700",
  NOT_REQUIRED: "bg-cream-100 text-ink-700",
};

export function OrderStatusBadge({ status }: { status: string }) {
  return <span className={cn("inline-flex rounded-full px-2.5 py-1 text-[11px] font-medium", ORDER_TONE[status])}>{ORDER_STATUS_LABEL[status] ?? status}</span>;
}

export function PaymentStatusBadge({ status }: { status: string }) {
  return <span className={cn("inline-flex rounded-full px-2.5 py-1 text-[11px] font-medium", PAY_TONE[status])}>{PAYMENT_STATUS_LABEL[status] ?? status}</span>;
}
