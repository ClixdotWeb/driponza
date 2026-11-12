"use client";

import { useRouter } from "next/navigation";
import { useActionState } from "react";
import { ActionForm, FormMessage, SubmitButton } from "@/components/ui/Form";
import { saveSettingsAction } from "@/server/actions/admin-orders";
import { setFeaturedOrderAction, toggleFeaturedAction } from "@/server/actions/admin-catalog";
import type { Settings } from "@/lib/settings";

function Input({ label, name, defaultValue, className, ...rest }: { label: string; name: string; defaultValue?: string | number } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className={className}>
      <label className="field-label" htmlFor={`s-${name}`}>{label}</label>
      <input id={`s-${name}`} name={name} defaultValue={defaultValue} className="field-input py-2" {...rest} />
    </div>
  );
}

function Area({ label, name, defaultValue, rows = 3, className }: { label: string; name: string; defaultValue?: string; rows?: number; className?: string }) {
  return (
    <div className={className}>
      <label className="field-label" htmlFor={`s-${name}`}>{label}</label>
      <textarea id={`s-${name}`} name={name} defaultValue={defaultValue} rows={rows} className="field-input" />
    </div>
  );
}

export function ContentForm({ content }: { content: Settings["content"] }) {
  const [state, action] = useActionState(saveSettingsAction, null);
  return (
    <ActionForm action={action} className="grid gap-4 md:grid-cols-2">
      <input type="hidden" name="section" value="content" />
      <div className="md:col-span-2"><FormMessage state={state} /></div>
      <Input label="Announcement bar" name="announcement" defaultValue={content.announcement} className="md:col-span-2" />
      <Input label="Hero eyebrow" name="heroEyebrow" defaultValue={content.heroEyebrow} />
      <div />
      <Input label="Hero headline – line 1" name="heroLine1" defaultValue={content.heroLine1} />
      <Input label="Hero headline – line 2 (italic)" name="heroLine2" defaultValue={content.heroLine2} />
      <Area label="Hero text" name="heroText" defaultValue={content.heroText} className="md:col-span-2" />
      <Input label="Hand-written note 1" name="annotation1" defaultValue={content.annotations[0]} />
      <Input label="Hand-written note 2" name="annotation2" defaultValue={content.annotations[1]} />
      <Input label="Hand-written note 3" name="annotation3" defaultValue={content.annotations[2]} />
      <div />
      <Area label="Brand statement (large text section)" name="statement" defaultValue={content.statement} rows={4} className="md:col-span-2" />
      <Input label="Story title" name="storyTitle" defaultValue={content.storyTitle} className="md:col-span-2" />
      <Area label="Story text" name="storyText" defaultValue={content.storyText} rows={4} className="md:col-span-2" />
      <Input label="Closing CTA title" name="ctaTitle" defaultValue={content.ctaTitle} />
      <Input label="Closing CTA text" name="ctaText" defaultValue={content.ctaText} />
      <div><SubmitButton>Save content</SubmitButton></div>
    </ActionForm>
  );
}

export function ContactForm({ contact }: { contact: Settings["contact"] }) {
  const [state, action] = useActionState(saveSettingsAction, null);
  return (
    <ActionForm action={action} className="grid gap-4 md:grid-cols-2">
      <input type="hidden" name="section" value="contact" />
      <div className="md:col-span-2"><FormMessage state={state} /></div>
      <Input label="Phone (displayed)" name="phone" defaultValue={contact.phone} />
      <Input label="WhatsApp number (digits with country code, e.g. 9199…)" name="whatsapp" defaultValue={contact.whatsapp} />
      <Input label="Email" name="email" type="email" defaultValue={contact.email} />
      <Input label="Website" name="website" defaultValue={contact.website} />
      <Area label="Address (one line per row)" name="addressLines" defaultValue={contact.addressLines.join("\n")} rows={4} />
      <Input label="Google Maps link" name="mapUrl" defaultValue={contact.mapUrl} />
      <Input label="Instagram URL" name="instagram" defaultValue={contact.instagram} />
      <Input label="Facebook URL" name="facebook" defaultValue={contact.facebook} />
      <Input label="YouTube URL" name="youtube" defaultValue={contact.youtube} />
      <div className="md:col-span-2"><SubmitButton>Save contact details</SubmitButton></div>
    </ActionForm>
  );
}

const r = (p: number | null) => (p === null ? "" : (p / 100).toString());
const Heading = ({ children }: { children: React.ReactNode }) => <p className="mt-2 text-xs font-semibold uppercase tracking-wider text-ink-500 md:col-span-2">{children}</p>;

export function CommerceForm({ commerce }: { commerce: Settings["commerce"] }) {
  const [state, action] = useActionState(saveSettingsAction, null);
  return (
    <ActionForm action={action} className="grid gap-4 md:grid-cols-2">
      <input type="hidden" name="section" value="commerce" />
      <div className="md:col-span-2"><FormMessage state={state} /></div>
      <Heading>Payment methods</Heading>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="bankTransferEnabled" defaultChecked={commerce.bankTransferEnabled} className="accent-green-600" /> Accept bank transfer / UPI (needs bank details below)</label>
      <Input label="Hold unpaid bank-transfer orders for (hours)" name="bankTransferHoldHours" inputMode="numeric" defaultValue={commerce.bankTransferHoldHours} />
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="codEnabled" defaultChecked={commerce.codEnabled} className="accent-green-600" /> Offer cash on delivery</label>
      <Input label="COD charge ₹ (used only when no shipping zones exist)" name="codCharge" inputMode="decimal" defaultValue={r(commerce.codChargePaise)} />
      <Input label="COD only up to order value ₹ (empty = no limit)" name="codMaxOrder" inputMode="decimal" defaultValue={r(commerce.codMaxOrderPaise)} />
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="whatsappOrdering" defaultChecked={commerce.whatsappOrdering} className="accent-green-600" /> Show “order on WhatsApp” option in cart</label>
      <Heading>Default shipping (used only if no shipping zones are set up)</Heading>
      <Input label="Flat shipping charge ₹" name="shippingFlat" inputMode="decimal" defaultValue={r(commerce.shippingFlatPaise)} />
      <Input label="Free shipping above ₹ (empty = never)" name="freeShippingAbove" inputMode="decimal" defaultValue={r(commerce.freeShippingAbovePaise)} />
      <Heading>Order rules</Heading>
      <Input label="Minimum order value ₹" name="minOrder" inputMode="decimal" defaultValue={r(commerce.minOrderPaise)} />
      <Input label="Max quantity per item" name="maxQtyPerLine" inputMode="numeric" defaultValue={commerce.maxQtyPerLine} />
      <Input label="Return window in days (empty = decide per request)" name="returnWindowDays" inputMode="numeric" defaultValue={commerce.returnWindowDays ?? ""} />
      <div className="md:col-span-2"><SubmitButton>Save payments & order rules</SubmitButton></div>
    </ActionForm>
  );
}

export function BankForm({ bank }: { bank: Settings["bank"] }) {
  const [state, action] = useActionState(saveSettingsAction, null);
  return (
    <ActionForm action={action} className="grid gap-4 md:grid-cols-2">
      <input type="hidden" name="section" value="bank" />
      <div className="md:col-span-2"><FormMessage state={state} /></div>
      <p className="rounded-xl bg-[#f4f5f2] p-3 text-xs text-ink-700 md:col-span-2">Shown only to a customer on their own unpaid bank-transfer order – never on public pages. Enter the details exactly as on your bank records.</p>
      <Input label="Account holder name" name="accountName" defaultValue={bank.accountName} />
      <Input label="Bank name" name="bankName" defaultValue={bank.bankName} />
      <Input label="Account number" name="accountNumber" defaultValue={bank.accountNumber} autoComplete="off" />
      <Input label="IFSC" name="ifsc" defaultValue={bank.ifsc} maxLength={11} />
      <Input label="Branch" name="branch" defaultValue={bank.branch} />
      <Input label="UPI ID (optional)" name="upiId" defaultValue={bank.upiId} />
      <Area label="Extra instructions for customers (optional)" name="instructions" defaultValue={bank.instructions} className="md:col-span-2" />
      <div className="md:col-span-2"><SubmitButton>Save bank details</SubmitButton></div>
    </ActionForm>
  );
}

export function BusinessForm({ business }: { business: Settings["business"] }) {
  const [state, action] = useActionState(saveSettingsAction, null);
  return (
    <ActionForm action={action} className="grid gap-4 md:grid-cols-2">
      <input type="hidden" name="section" value="business" />
      <div className="md:col-span-2"><FormMessage state={state} /></div>
      <Input label="Legal / trade name (on invoices)" name="legalName" defaultValue={business.legalName} />
      <Input label="GSTIN (leave empty if not registered)" name="gstin" defaultValue={business.gstin} maxLength={15} />
      <Input label="Invoice number prefix" name="invoicePrefix" defaultValue={business.invoicePrefix} maxLength={12} />
      <Input label="State of supply (CGST+SGST vs IGST)" name="stateOfSupply" defaultValue={business.stateOfSupply} />
      <Area label="Invoice footer (optional)" name="invoiceFooter" defaultValue={business.invoiceFooter} className="md:col-span-2" />
      <div className="md:col-span-2"><SubmitButton>Save business details</SubmitButton></div>
    </ActionForm>
  );
}

export function PoliciesForm({ policies }: { policies: Settings["policies"] }) {
  const [state, action] = useActionState(saveSettingsAction, null);
  return (
    <ActionForm action={action} className="grid gap-4">
      <input type="hidden" name="section" value="policies" />
      <FormMessage state={state} />
      <p className="text-xs text-ink-500">Plain text. Leave a blank line between paragraphs; start a line with “## ” for a heading. Razorpay requires these pages before going live.</p>
      <Area label="Shipping policy" name="shipping" defaultValue={policies.shipping} rows={5} />
      <Area label="Returns & refunds" name="returns" defaultValue={policies.returns} rows={5} />
      <Area label="Privacy policy" name="privacy" defaultValue={policies.privacy} rows={5} />
      <Area label="Terms & conditions" name="terms" defaultValue={policies.terms} rows={5} />
      <div><SubmitButton>Save policies</SubmitButton></div>
    </ActionForm>
  );
}

export function FeaturedManager({ products }: { products: { id: string; name: string; isFeatured: boolean; featuredOrder: number }[] }) {
  const router = useRouter();
  return (
    <div>
      <p className="mb-3 text-xs text-ink-500">Featured products appear in the homepage product grid (up to 8), sorted by the order number.</p>
      <ul className="divide-y divide-cream-100">
        {products.map((p) => (
          <li key={p.id} className="flex items-center gap-4 py-2.5 text-sm">
            <label className="flex flex-1 items-center gap-2">
              <input
                type="checkbox"
                defaultChecked={p.isFeatured}
                className="accent-green-600"
                onChange={async (e) => {
                  await toggleFeaturedAction(p.id, e.target.checked);
                  router.refresh();
                }}
              />
              {p.name}
            </label>
            <label className="flex items-center gap-2 text-xs text-ink-500">
              Order
              <input
                type="number"
                min={0}
                defaultValue={p.featuredOrder}
                className="field-input w-20 py-1.5"
                onBlur={async (e) => {
                  if (Number(e.target.value) !== p.featuredOrder) {
                    await setFeaturedOrderAction(p.id, Number(e.target.value));
                    router.refresh();
                  }
                }}
              />
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
}
