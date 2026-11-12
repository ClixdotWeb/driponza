export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function slugify(input: string) {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function formatDate(d: Date | string, withTime = false) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
    timeZone: "Asia/Kolkata",
  }).format(new Date(d));
}

/** Only allow same-site relative redirects (prevents open redirects). */
export function safeRedirect(target: unknown, fallback = "/") {
  if (typeof target !== "string") return fallback;
  if (!target.startsWith("/") || target.startsWith("//") || target.startsWith("/\\")) return fallback;
  return target;
}

export const ORDER_STATUS_LABEL: Record<string, string> = {
  PENDING_PAYMENT: "Awaiting payment",
  CONFIRMED: "Confirmed",
  PROCESSING: "Processing",
  SHIPPED: "Shipped",
  DELIVERED: "Delivered",
  ON_HOLD: "On hold",
  CANCEL_REQUESTED: "Cancellation requested",
  CANCELLED: "Cancelled",
  PAYMENT_FAILED: "Payment failed",
  REFUNDED: "Refunded",
};

export const PAYMENT_STATUS_LABEL: Record<string, string> = {
  PENDING: "Pending",
  PAID: "Paid",
  FAILED: "Failed",
  REFUNDED: "Refunded",
  PARTIALLY_REFUNDED: "Partially refunded",
  NOT_REQUIRED: "Pay on delivery",
};

/** "DRIPONZA Premium Whole Black Pepper" → "Black Pepper" for compact, elegant labels. */
export function shortSpiceName(name: string) {
  return name.replace(/^(DRIPONZA\s+)?Premium\s+/i, "").replace(/^Whole\s+/i, "");
}
