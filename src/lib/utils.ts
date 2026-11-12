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

export { ORDER_STATUS_LABEL, PAYMENT_STATUS_LABEL } from "@/lib/order-status";

/** "DRIPONZA Premium Whole Black Pepper" → "Black Pepper" for compact, elegant labels. */
export function shortSpiceName(name: string) {
  return name.replace(/^(DRIPONZA\s+)?Premium\s+/i, "").replace(/^Whole\s+/i, "");
}
