"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { CreditCard, Lock, Truck, Wallet } from "lucide-react";
import { formatINR } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { CartView } from "@/server/cart";
import type { Pricing } from "@/server/orders";
import {
  applyCouponAction,
  placeOrderAction,
  removeCouponAction,
  reportPaymentFailureAction,
  verifyPaymentAction,
  type PlaceOrderResult,
} from "@/server/actions/checkout";

type Address = {
  id: string;
  label: string | null;
  fullName: string;
  phone: string;
  line1: string;
  line2: string | null;
  landmark: string | null;
  city: string;
  district: string | null;
  state: string;
  pincode: string;
  isDefault: boolean;
};

type RazorpayResponse = { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string };
type RazorpayInstance = { open: () => void; on: (e: string, cb: (r: { error: { code: string; description: string; metadata?: { order_id?: string } } }) => void) => void };
declare global {
  interface Window {
    Razorpay?: new (opts: Record<string, unknown>) => RazorpayInstance;
  }
}

function loadRazorpay(): Promise<boolean> {
  if (window.Razorpay) return Promise.resolve(true);
  return new Promise((resolve) => {
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
}

/** Opens Razorpay Checkout; success is only accepted after the server verifies it. Shared with the "retry payment" button. */
export async function launchRazorpay(launch: NonNullable<Extract<PlaceOrderResult, { ok: true }>["razorpay"]>, onDone: (r: { ok: boolean; message?: string }) => void) {
  if (!(await loadRazorpay()) || !window.Razorpay) return onDone({ ok: false, message: "Could not load the payment window. Check your connection and retry." });
  const rzp = new window.Razorpay({
    key: launch.keyId,
    amount: launch.amountPaise,
    currency: "INR",
    name: "Driponza",
    description: `Order ${launch.orderNumber}`,
    order_id: launch.razorpayOrderId,
    prefill: launch.prefill,
    theme: { color: "#2E7D3A" },
    handler: async (response: RazorpayResponse) => {
      const result = await verifyPaymentAction(response);
      onDone(result.ok ? { ok: true } : { ok: false, message: result.error });
    },
    modal: { ondismiss: () => onDone({ ok: false, message: "Payment was not completed. You can retry from your order page." }) },
  });
  rzp.on("payment.failed", (r) => {
    reportPaymentFailureAction(launch.razorpayOrderId, r.error.code, r.error.description);
  });
  rzp.open();
}

const blankAddress = { label: "", fullName: "", phone: "", line1: "", line2: "", landmark: "", city: "", district: "", state: "Kerala", pincode: "" };

export function CheckoutClient(props: {
  user: { name: string; email: string; phone: string | null };
  cart: CartView;
  initialPricing: Pricing;
  initialCoupon: string | null;
  addresses: Address[];
  states: string[];
  codEnabled: boolean;
  razorpayReady: boolean;
  whatsapp: string;
}) {
  const router = useRouter();
  const [addressId, setAddressId] = useState<string | "new">(props.addresses[0]?.id ?? "new");
  const [address, setAddress] = useState({ ...blankAddress, fullName: props.user.name, phone: props.user.phone ?? "" });
  const [saveAddress, setSaveAddress] = useState(true);
  const [method, setMethod] = useState<"RAZORPAY" | "COD">(props.razorpayReady || !props.codEnabled ? "RAZORPAY" : "COD");
  const [note, setNote] = useState("");
  const [pricing, setPricing] = useState(props.initialPricing);
  const [coupon, setCoupon] = useState(props.initialCoupon ?? "");
  const [appliedCoupon, setAppliedCoupon] = useState(props.initialCoupon);
  const [couponMsg, setCouponMsg] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const set = (k: keyof typeof blankAddress) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setAddress((a) => ({ ...a, [k]: e.target.value }));

  async function applyCoupon() {
    setCouponMsg(null);
    const res = await applyCouponAction(coupon);
    if (res.pricing) setPricing(res.pricing);
    if (res.ok) {
      setAppliedCoupon(coupon.trim().toUpperCase());
      setCouponMsg("Coupon applied");
    } else {
      setAppliedCoupon(null);
      setCouponMsg(res.error ?? "Invalid coupon");
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setErrors({});
    const res = await placeOrderAction({
      addressId: addressId === "new" ? undefined : addressId,
      address: addressId === "new" ? address : undefined,
      saveAddress: addressId === "new" && saveAddress,
      method,
      couponCode: appliedCoupon ?? undefined,
      note: note || undefined,
    });
    if (!res.ok) {
      setBusy(false);
      setError(res.error);
      setErrors(res.fieldErrors ?? {});
      return;
    }
    // Layouts aren't re-fetched on client navigation, so refresh to update the header cart count.
    const go = (url: string) => {
      router.push(url);
      router.refresh();
    };
    if (!res.razorpay) {
      go(`/account/orders/${res.orderNumber}?placed=1`);
      return;
    }
    await launchRazorpay(res.razorpay, (r) => {
      if (r.ok) go(`/account/orders/${res.orderNumber}?placed=1`);
      else go(`/account/orders/${res.orderNumber}?payment=${encodeURIComponent(r.message ?? "incomplete")}`);
    });
  }

  const step = (n: number, title: string, icon?: React.ReactNode) => (
    <h2 className="flex items-center gap-3 text-lg font-medium">
      <span className="grid size-8 place-items-center rounded-full bg-forest-800 text-sm text-ivory-50">{n}</span>
      {title} {icon}
    </h2>
  );

  return (
    <form onSubmit={submit} className="mt-10 grid gap-10 lg:grid-cols-[1fr_400px]" noValidate>
      <div className="grid gap-6">
        {/* 1 · Contact */}
        <section className="card p-6">
          {step(1, "Contact")}
          <p className="mt-4 text-sm text-ink-700">
            {props.user.name} · {props.user.email}
          </p>
          <p className="mt-1 text-xs text-ink-500">Order updates are sent to this email.</p>
        </section>

        {/* 2 · Delivery address */}
        <section className="card p-6">
          {step(2, "Delivery address")}
          <div className="mt-5 grid gap-3">
            {props.addresses.map((a) => (
              <label key={a.id} className={cn("flex cursor-pointer gap-3 rounded-2xl border p-4 transition", addressId === a.id ? "border-green-600 bg-botanical-100/60" : "border-cream-200 hover:border-sage-400")}>
                <input type="radio" name="addressId" checked={addressId === a.id} onChange={() => setAddressId(a.id)} className="mt-1 accent-green-600" />
                <span className="text-sm">
                  <span className="font-medium">{a.fullName}</span> {a.label && <span className="ml-1 rounded-full bg-cream-100 px-2 py-0.5 text-[11px]">{a.label}</span>}
                  <span className="mt-1 block text-ink-700">
                    {[a.line1, a.line2, a.landmark, a.city, a.district, a.state].filter(Boolean).join(", ")} – {a.pincode}
                  </span>
                  <span className="block text-ink-500">{a.phone}</span>
                </span>
              </label>
            ))}
            {props.addresses.length > 0 && (
              <label className={cn("flex cursor-pointer items-center gap-3 rounded-2xl border p-4 text-sm transition", addressId === "new" ? "border-green-600 bg-botanical-100/60" : "border-cream-200")}>
                <input type="radio" name="addressId" checked={addressId === "new"} onChange={() => setAddressId("new")} className="accent-green-600" />
                Use a new address
              </label>
            )}
          </div>
          {addressId === "new" && (
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              {(
                [
                  ["fullName", "Full name", "name"],
                  ["phone", "Mobile number", "tel"],
                  ["line1", "House / building, street", "address-line1"],
                  ["line2", "Area / locality (optional)", "address-line2"],
                  ["landmark", "Landmark (optional)", "off"],
                  ["city", "City / town", "address-level2"],
                  ["district", "District (optional)", "off"],
                  ["pincode", "PIN code", "postal-code"],
                ] as const
              ).map(([k, label, ac]) => (
                <div key={k} className={k === "line1" ? "sm:col-span-2" : ""}>
                  <label htmlFor={`addr-${k}`} className="field-label">{label}</label>
                  <input id={`addr-${k}`} className="field-input" autoComplete={ac} inputMode={k === "phone" || k === "pincode" ? "numeric" : undefined} value={address[k]} onChange={set(k)} aria-invalid={errors[k] ? true : undefined} />
                  {errors[k] && <p className="field-error">{errors[k]}</p>}
                </div>
              ))}
              <div>
                <label htmlFor="addr-state" className="field-label">State</label>
                <select id="addr-state" className="field-input" value={address.state} onChange={set("state")} autoComplete="address-level1">
                  {props.states.map((s) => <option key={s}>{s}</option>)}
                </select>
              </div>
              <label className="flex items-center gap-2 self-end pb-3 text-sm">
                <input type="checkbox" checked={saveAddress} onChange={(e) => setSaveAddress(e.target.checked)} className="accent-green-600" /> Save to my addresses
              </label>
            </div>
          )}
        </section>

        {/* 3 · Shipping */}
        <section className="card p-6">
          {step(3, "Shipping", <Truck className="size-4 text-green-600" />)}
          <p className="mt-4 text-sm text-ink-700">
            Standard delivery · <span className="font-medium">{pricing.shippingPaise === 0 ? "No shipping charge" : formatINR(pricing.shippingPaise)}</span>
          </p>
          <label htmlFor="note" className="field-label mt-5">Order note (optional)</label>
          <input id="note" className="field-input" maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Any delivery instructions?" />
        </section>

        {/* 4 · Payment */}
        <section className="card p-6">
          {step(4, "Payment")}
          <div className="mt-5 grid gap-3">
            <label className={cn("flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition", method === "RAZORPAY" ? "border-green-600 bg-botanical-100/60" : "border-cream-200", !props.razorpayReady && "opacity-60")}>
              <input type="radio" name="method" disabled={!props.razorpayReady} checked={method === "RAZORPAY"} onChange={() => setMethod("RAZORPAY")} className="mt-1 accent-green-600" />
              <span className="text-sm">
                <span className="flex items-center gap-2 font-medium"><CreditCard className="size-4" /> Pay online — UPI, cards, net banking, wallets</span>
                <span className="mt-1 block text-ink-500">{props.razorpayReady ? "Secured by Razorpay." : "Online payment is being set up (awaiting Razorpay credentials)."}</span>
              </span>
            </label>
            {props.codEnabled && (
              <label className={cn("flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition", method === "COD" ? "border-green-600 bg-botanical-100/60" : "border-cream-200")}>
                <input type="radio" name="method" checked={method === "COD"} onChange={() => setMethod("COD")} className="mt-1 accent-green-600" />
                <span className="text-sm">
                  <span className="flex items-center gap-2 font-medium"><Wallet className="size-4" /> Cash on delivery</span>
                  <span className="mt-1 block text-ink-500">Pay when your order arrives.</span>
                </span>
              </label>
            )}
            {!props.razorpayReady && !props.codEnabled && (
              <p className="rounded-xl bg-cream-100 p-4 text-sm text-ink-700">
                Online checkout opens soon. Meanwhile you can{" "}
                <a className="text-green-600 underline" href={`https://wa.me/${props.whatsapp}`} target="_blank" rel="noopener noreferrer">order on WhatsApp</a>.
              </p>
            )}
          </div>
        </section>
      </div>

      {/* Summary */}
      <aside className="card h-fit p-6 lg:sticky lg:top-28">
        <h2 className="display text-3xl">Order summary</h2>
        <ul className="mt-5 max-h-72 space-y-4 overflow-y-auto pr-1">
          {props.cart.lines.map((l) => (
            <li key={l.id} className="flex gap-3">
              <span className="relative size-14 shrink-0 overflow-hidden rounded-xl bg-cream-100">
                {l.image && <Image src={l.image} alt="" fill sizes="56px" className="object-cover" />}
                <span className="absolute right-0.5 top-0.5 grid size-5 place-items-center rounded-full bg-forest-800 text-[10px] text-ivory-50">{l.quantity}</span>
              </span>
              <span className="min-w-0 flex-1 text-sm">
                <span className="block truncate font-medium">{l.name}</span>
                <span className="text-ink-500">{l.variantLabel}</span>
              </span>
              <span className="text-sm tabular-nums">{formatINR(l.lineTotalPaise)}</span>
            </li>
          ))}
        </ul>

        <div className="mt-5 flex gap-2">
          <label htmlFor="coupon" className="sr-only">Coupon code</label>
          <input id="coupon" className="field-input py-2.5 uppercase" placeholder="Coupon code" value={coupon} onChange={(e) => setCoupon(e.target.value)} />
          {appliedCoupon ? (
            <button
              type="button"
              className="btn btn-outline btn-sm text-forest-800"
              onClick={async () => {
                setPricing(await removeCouponAction());
                setAppliedCoupon(null);
                setCoupon("");
                setCouponMsg(null);
              }}
            >
              Remove
            </button>
          ) : (
            <button type="button" className="btn btn-outline btn-sm text-forest-800" onClick={applyCoupon} disabled={!coupon.trim()}>
              Apply
            </button>
          )}
        </div>
        {couponMsg && <p className={cn("mt-2 text-xs", appliedCoupon ? "text-green-600" : "text-danger-600")}>{couponMsg}</p>}

        <dl className="mt-5 space-y-2.5 border-t border-cream-200 pt-5 text-sm">
          <div className="flex justify-between"><dt className="text-ink-700">Subtotal</dt><dd className="tabular-nums">{formatINR(pricing.subtotalPaise)}</dd></div>
          {pricing.discountPaise > 0 && (
            <div className="flex justify-between text-green-600"><dt>Discount {pricing.coupon && `(${pricing.coupon.code})`}</dt><dd className="tabular-nums">−{formatINR(pricing.discountPaise)}</dd></div>
          )}
          <div className="flex justify-between"><dt className="text-ink-700">Shipping</dt><dd className="tabular-nums">{pricing.shippingPaise ? formatINR(pricing.shippingPaise) : "₹0"}</dd></div>
          <div className="flex items-baseline justify-between border-t border-cream-200 pt-3"><dt className="font-medium">Total</dt><dd className="display text-3xl tabular-nums">{formatINR(pricing.totalPaise)}</dd></div>
        </dl>

        {error && <p role="alert" className="mt-4 rounded-xl bg-danger-600/10 p-3 text-sm text-danger-600">{error}</p>}
        <button type="submit" disabled={busy || (!props.razorpayReady && method === "RAZORPAY")} className="btn btn-primary mt-5 w-full py-4 text-[15px]">
          <Lock className="size-4" />
          {busy ? "Processing…" : method === "COD" ? "Place order" : `Pay ${formatINR(pricing.totalPaise)}`}
        </button>
        <p className="mt-3 text-center text-xs text-ink-500">By placing your order you agree to our terms and policies.</p>
      </aside>
    </form>
  );
}
