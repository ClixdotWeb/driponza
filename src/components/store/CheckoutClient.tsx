"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Landmark, Lock, Truck, Wallet } from "lucide-react";
import { formatINR } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { CartView } from "@/server/cart";
import type { Quote } from "@/server/orders";
import { applyCouponAction, placeOrderAction, quoteAction, removeCouponAction, type QuoteInput } from "@/server/actions/checkout";

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

type Method = "BANK_TRANSFER" | "COD";
const blankAddress = { label: "", fullName: "", phone: "", line1: "", line2: "", landmark: "", city: "", district: "", state: "Kerala", pincode: "" };

export function CheckoutClient(props: {
  user: { name: string; email: string; phone: string | null } | null;
  cart: CartView;
  initialQuote: Quote;
  initialCoupon: string | null;
  addresses: Address[];
  states: string[];
  whatsapp: string;
}) {
  const router = useRouter();
  const [addressId, setAddressId] = useState<string | "new">(props.addresses[0]?.id ?? "new");
  const [address, setAddress] = useState({ ...blankAddress, fullName: props.user?.name ?? "", phone: props.user?.phone ?? "" });
  const [email, setEmail] = useState(props.user?.email ?? "");
  const [saveAddress, setSaveAddress] = useState(true);
  const initialMethod: Method = props.initialQuote.methods.BANK_TRANSFER.available || !props.initialQuote.methods.COD.available ? "BANK_TRANSFER" : "COD";
  const [method, setMethod] = useState<Method>(initialMethod);
  const [instructions, setInstructions] = useState("");
  const [note, setNote] = useState("");
  const [terms, setTerms] = useState(false);
  const [quote, setQuote] = useState(props.initialQuote);
  const [coupon, setCoupon] = useState(props.initialCoupon ?? "");
  const [appliedCoupon, setAppliedCoupon] = useState(props.initialCoupon);
  const [couponMsg, setCouponMsg] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [quoting, startQuote] = useTransition();
  const submitted = useRef(false);

  const selected = addressId === "new" ? null : props.addresses.find((a) => a.id === addressId) ?? null;
  const pincode = selected?.pincode ?? address.pincode;
  const state = selected?.state ?? address.state;
  const quoteInput: QuoteInput = { pincode, state, method, email };
  const pinValid = /^[1-9]\d{5}$/.test(pincode);

  // Re-price on the server whenever the delivery PIN/state or payment method changes.
  useEffect(() => {
    if (!pinValid) return;
    const t = setTimeout(() => startQuote(async () => setQuote(await quoteAction({ pincode, state, method, email }))), 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pincode, state, method, pinValid]);

  // If the chosen method becomes unavailable (e.g. COD not allowed for this PIN), switch to the other.
  useEffect(() => {
    if (!quote.methods[method].available) {
      const other: Method = method === "COD" ? "BANK_TRANSFER" : "COD";
      if (quote.methods[other].available) setMethod(other);
    }
  }, [quote, method]);

  const set = (k: keyof typeof blankAddress) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setAddress((a) => ({ ...a, [k]: e.target.value }));

  async function applyCoupon() {
    setCouponMsg(null);
    const res = await applyCouponAction(coupon, quoteInput);
    setQuote(res.quote);
    if (res.ok) {
      setAppliedCoupon(coupon.trim().toUpperCase());
      setCouponMsg("Coupon applied");
    } else {
      setAppliedCoupon(null);
      setCouponMsg(res.error ?? "Invalid coupon");
    }
  }

  const anyMethod = quote.methods.BANK_TRANSFER.available || quote.methods.COD.available;
  const canSubmit = !busy && !quoting && anyMethod && quote.methods[method].available && quote.serviceable && pinValid && terms;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (submitted.current || !canSubmit) return; // guards double clicks before the server guard
    submitted.current = true;
    setBusy(true);
    setError(null);
    setErrors({});
    const res = await placeOrderAction({
      contact: props.user ? undefined : { email },
      addressId: addressId === "new" ? undefined : addressId,
      address: addressId === "new" ? address : undefined,
      saveAddress: Boolean(props.user) && addressId === "new" && saveAddress,
      method,
      expectedTotalPaise: quote.totals.totalPaise,
      deliveryInstructions: instructions || undefined,
      note: note || undefined,
      acceptTerms: terms,
    });
    if (!res.ok) {
      submitted.current = false;
      setBusy(false);
      setError(res.error);
      setErrors(res.fieldErrors ?? {});
      if (res.quote) setQuote(res.quote);
      return;
    }
    router.push(res.url);
    router.refresh(); // updates the header cart count
  }

  const step = (n: number, title: string, icon?: React.ReactNode) => (
    <h2 className="flex items-center gap-3 text-lg font-medium">
      <span className="grid size-8 place-items-center rounded-full bg-forest-800 text-sm text-ivory-50">{n}</span>
      {title} {icon}
    </h2>
  );

  const methodCard = (m: Method, title: string, icon: React.ReactNode, desc: string) => {
    const info = quote.methods[m];
    return (
      <label className={cn("flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition", method === m ? "border-green-600 bg-botanical-100/60" : "border-cream-200", !info.available && "cursor-not-allowed opacity-60")}>
        <input type="radio" name="method" disabled={!info.available} checked={method === m} onChange={() => setMethod(m)} className="mt-1 accent-green-600" />
        <span className="text-sm">
          <span className="flex items-center gap-2 font-medium">{icon} {title}</span>
          <span className="mt-1 block text-ink-500">{info.available ? desc : info.reason}</span>
        </span>
      </label>
    );
  };

  const t = quote.totals;
  return (
    <form onSubmit={submit} className="mt-10 grid gap-10 lg:grid-cols-[1fr_400px]" noValidate>
      <div className="grid gap-6">
        {/* 1 · Contact */}
        <section className="card p-6">
          {step(1, "Contact")}
          {props.user ? (
            <>
              <p className="mt-4 text-sm text-ink-700">{props.user.name} · {props.user.email}</p>
              <p className="mt-1 text-xs text-ink-500">Order updates are sent to this email.</p>
            </>
          ) : (
            <div className="mt-4">
              <label htmlFor="co-email" className="field-label">Email for order updates</label>
              <input id="co-email" type="email" autoComplete="email" className="field-input" value={email} onChange={(e) => setEmail(e.target.value)} aria-invalid={errors.email ? true : undefined} required />
              {errors.email && <p className="field-error">{errors.email}</p>}
              <p className="mt-2 text-xs text-ink-500">
                Checking out as a guest. <Link href="/login?next=/checkout" className="text-green-600 underline">Sign in</Link> to use saved addresses.
              </p>
            </div>
          )}
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
                  <span className="mt-1 block text-ink-700">{[a.line1, a.line2, a.landmark, a.city, a.district, a.state].filter(Boolean).join(", ")} – {a.pincode}</span>
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
                  <input
                    id={`addr-${k}`}
                    className="field-input"
                    autoComplete={ac}
                    inputMode={k === "phone" || k === "pincode" ? "numeric" : undefined}
                    maxLength={k === "pincode" ? 6 : undefined}
                    value={address[k]}
                    onChange={set(k)}
                    aria-invalid={errors[k] ? true : undefined}
                  />
                  {errors[k] && <p className="field-error">{errors[k]}</p>}
                </div>
              ))}
              <div>
                <label htmlFor="addr-state" className="field-label">State</label>
                <select id="addr-state" className="field-input" value={address.state} onChange={set("state")} autoComplete="address-level1">
                  {props.states.map((s) => <option key={s}>{s}</option>)}
                </select>
              </div>
              {props.user && (
                <label className="flex items-center gap-2 self-end pb-3 text-sm">
                  <input type="checkbox" checked={saveAddress} onChange={(e) => setSaveAddress(e.target.checked)} className="accent-green-600" /> Save to my addresses
                </label>
              )}
            </div>
          )}
        </section>

        {/* 3 · Shipping */}
        <section className="card p-6">
          {step(3, "Shipping", <Truck className="size-4 text-green-600" />)}
          <div className="mt-4 text-sm text-ink-700" aria-live="polite">
            {!pinValid ? (
              <p className="text-ink-500">Enter a 6-digit PIN code to see delivery options.</p>
            ) : !quote.serviceable ? (
              <p className="rounded-xl bg-danger-600/10 p-3 text-danger-600">Sorry, we don&apos;t deliver to {pincode} yet. <a className="underline" href={`https://wa.me/${props.whatsapp}`} target="_blank" rel="noopener noreferrer">Ask us on WhatsApp</a>.</p>
            ) : (
              <p>
                {quote.zone?.name ?? "Standard delivery"}
                {quote.zone && <> · {quote.zone.minDays}–{quote.zone.maxDays} days</>} ·{" "}
                <span className="font-medium">{t.shippingPaise === 0 ? "Free" : formatINR(t.shippingPaise)}</span>
                {quoting && <span className="ml-2 text-ink-500">updating…</span>}
              </p>
            )}
          </div>
          <label htmlFor="instr" className="field-label mt-5">Delivery instructions (optional)</label>
          <input id="instr" className="field-input" maxLength={300} value={instructions} onChange={(e) => setInstructions(e.target.value)} placeholder="e.g. Call before delivery, leave with security" />
          <label htmlFor="note" className="field-label mt-4">Order note (optional)</label>
          <input id="note" className="field-input" maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
        </section>

        {/* 4 · Payment */}
        <section className="card p-6">
          {step(4, "Payment")}
          <div className="mt-5 grid gap-3">
            {methodCard("BANK_TRANSFER", "Bank transfer / UPI", <Landmark className="size-4" />, "Pay to our bank account after placing the order, then submit your transaction reference. We confirm once it reaches our account.")}
            {methodCard(
              "COD",
              "Cash on delivery",
              <Wallet className="size-4" />,
              quote.totals.codChargePaise > 0 ? `Pay when your order arrives (${formatINR(quote.totals.codChargePaise)} COD charge).` : "Pay when your order arrives.",
            )}
            {!anyMethod && (
              <p className="rounded-xl bg-cream-100 p-4 text-sm text-ink-700">
                Online ordering opens soon. Meanwhile you can{" "}
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
                setQuote(await removeCouponAction(quoteInput));
                setAppliedCoupon(null);
                setCoupon("");
                setCouponMsg(null);
              }}
            >
              Remove
            </button>
          ) : (
            <button type="button" className="btn btn-outline btn-sm text-forest-800" onClick={applyCoupon} disabled={!coupon.trim()}>Apply</button>
          )}
        </div>
        {couponMsg && <p className={cn("mt-2 text-xs", appliedCoupon ? "text-green-600" : "text-danger-600")}>{couponMsg}</p>}

        <dl className="mt-5 space-y-2.5 border-t border-cream-200 pt-5 text-sm">
          <div className="flex justify-between"><dt className="text-ink-700">Subtotal</dt><dd className="tabular-nums">{formatINR(t.subtotalPaise)}</dd></div>
          {t.discountPaise > 0 && (
            <div className="flex justify-between text-green-600"><dt>Discount {quote.coupon && `(${quote.coupon.code})`}</dt><dd className="tabular-nums">−{formatINR(t.discountPaise)}</dd></div>
          )}
          <div className="flex justify-between"><dt className="text-ink-700">Shipping</dt><dd className="tabular-nums">{pinValid ? (t.shippingPaise ? formatINR(t.shippingPaise) : "Free") : "—"}</dd></div>
          {t.codChargePaise > 0 && <div className="flex justify-between"><dt className="text-ink-700">COD charge</dt><dd className="tabular-nums">{formatINR(t.codChargePaise)}</dd></div>}
          <div className="flex items-baseline justify-between border-t border-cream-200 pt-3"><dt className="font-medium">Total</dt><dd className="display text-3xl tabular-nums">{formatINR(t.totalPaise)}</dd></div>
          {t.taxPaise > 0 && <p className="text-right text-xs text-ink-500">Includes {formatINR(t.taxPaise)} GST</p>}
        </dl>

        <label className="mt-5 flex items-start gap-2 text-xs text-ink-700">
          <input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} className="mt-0.5 accent-green-600" />
          <span>
            I agree to the <Link href="/policies/terms" className="underline">terms</Link>, <Link href="/policies/shipping" className="underline">shipping</Link> and{" "}
            <Link href="/policies/returns" className="underline">return policy</Link>.
          </span>
        </label>
        {errors.acceptTerms && <p className="field-error">{errors.acceptTerms}</p>}

        {error && <p role="alert" className="mt-4 rounded-xl bg-danger-600/10 p-3 text-sm text-danger-600">{error}</p>}
        <button type="submit" disabled={!canSubmit} className="btn btn-primary mt-5 w-full py-4 text-[15px]">
          <Lock className="size-4" />
          {busy ? "Placing order…" : `Place order · ${formatINR(t.totalPaise)}`}
        </button>
        <p className="mt-3 text-center text-xs text-ink-500">
          {method === "BANK_TRANSFER" ? "You'll see our bank details on the next page. Your order is confirmed once payment is verified." : "Pay in cash when your order is delivered."}
        </p>
      </aside>
    </form>
  );
}
