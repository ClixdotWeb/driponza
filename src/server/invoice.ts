import "server-only";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { db } from "@/lib/db";
import { toPaise } from "@/lib/money";
import { getSettings } from "@/lib/settings";

// Standard PDF fonts are WinAnsi-only (no ₹ glyph), so amounts print as "Rs." – avoids embedding font files.
const rs = (paise: number) => `Rs. ${(paise / 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const ascii = (s: string) => s.replace(/[^\x20-\x7E -ÿ]/g, "-");

/**
 * Tax invoice PDF built only from data recorded on the order and the business details entered in settings.
 * If no GSTIN is configured the document is titled "Invoice" (not "Tax invoice") and no GST registration is implied.
 */
export async function renderInvoicePdf(orderId: string) {
  const [order, settings] = await Promise.all([db.order.findUniqueOrThrow({ where: { id: orderId }, include: { items: true } }), getSettings()]);
  if (!order.invoiceNumber) throw new Error("Invoice not issued yet");
  const { business, contact } = settings;
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Invoice ${order.invoiceNumber}`);
  pdf.setProducer("Driponza");
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  let page = pdf.addPage([595.28, 841.89]); // A4
  const green = rgb(0.07, 0.24, 0.13);
  const grey = rgb(0.4, 0.43, 0.4);
  let y = 800;
  const text = (p: PDFPage, s: string, x: number, yy: number, opts: { size?: number; f?: PDFFont; color?: ReturnType<typeof rgb>; right?: boolean } = {}) => {
    const size = opts.size ?? 9.5;
    const f = opts.f ?? font;
    const str = ascii(s);
    p.drawText(str, { x: opts.right ? x - f.widthOfTextAtSize(str, size) : x, y: yy, size, font: f, color: opts.color ?? rgb(0.08, 0.09, 0.08) });
  };

  text(page, business.legalName || "Driponza", 48, y, { size: 18, f: bold, color: green });
  text(page, business.gstin ? "TAX INVOICE" : "INVOICE", 547, y, { size: 14, f: bold, right: true });
  y -= 18;
  for (const l of contact.addressLines) { text(page, l, 48, y, { color: grey }); y -= 12; }
  text(page, `${contact.phone}  ·  ${contact.email}`.replace("·", "|"), 48, y, { color: grey });
  y -= 12;
  if (business.gstin) { text(page, `GSTIN: ${business.gstin}`, 48, y, { f: bold }); y -= 12; }

  let ry = 782;
  for (const [k, v] of [
    ["Invoice no.", order.invoiceNumber],
    ["Invoice date", (order.invoicedAt ?? order.createdAt).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" })],
    ["Order no.", order.number],
    ["Payment", order.paymentMethod === "COD" ? "Cash on delivery" : order.paymentMethod === "BANK_TRANSFER" ? "Bank transfer" : "Online"],
    ["Place of supply", order.shipState],
  ] as const) {
    text(page, `${k}: ${v}`, 547, ry, { right: true, color: grey });
    ry -= 12;
  }

  y = Math.min(y, ry) - 20;
  text(page, "Bill / ship to", 48, y, { f: bold });
  y -= 13;
  for (const l of [order.billName || order.shipName, order.billLine1 || [order.shipLine1, order.shipLine2].filter(Boolean).join(", "), `${order.billCity || order.shipCity}, ${order.billState || order.shipState} - ${order.billPincode || order.shipPincode}`, order.shipPhone, order.email, order.billGstin ? `GSTIN: ${order.billGstin}` : ""]) {
    if (!l) continue;
    text(page, l, 48, y);
    y -= 12;
  }

  // Items table
  y -= 14;
  const cols = { item: 48, hsn: 300, qty: 350, rate: 420, gst: 470, amt: 547 };
  const header = () => {
    page.drawRectangle({ x: 40, y: y - 5, width: 515, height: 18, color: rgb(0.93, 0.95, 0.92) });
    text(page, "Item", cols.item, y, { f: bold });
    text(page, "HSN", cols.hsn, y, { f: bold });
    text(page, "Qty", cols.qty, y, { f: bold, right: true });
    text(page, "Rate", cols.rate, y, { f: bold, right: true });
    text(page, "GST %", cols.gst, y, { f: bold, right: true });
    text(page, "Amount", cols.amt, y, { f: bold, right: true });
    y -= 20;
  };
  header();
  for (const i of order.items) {
    if (y < 120) { page = pdf.addPage([595.28, 841.89]); y = 800; header(); }
    const name = `${i.productName} (${i.variantLabel})`;
    text(page, name.length > 48 ? `${name.slice(0, 47)}…` : name, cols.item, y);
    text(page, i.hsnCode ?? "-", cols.hsn, y);
    text(page, String(i.quantity), cols.qty, y, { right: true });
    text(page, rs(toPaise(i.unitPrice)), cols.rate, y, { right: true });
    text(page, i.taxRatePercent ? Number(i.taxRatePercent).toString() : "-", cols.gst, y, { right: true });
    text(page, rs(toPaise(i.lineTotal)), cols.amt, y, { right: true });
    y -= 16;
  }

  y -= 6;
  page.drawLine({ start: { x: 330, y: y + 8 }, end: { x: 555, y: y + 8 }, thickness: 0.5, color: grey });
  const sum = (label: string, paise: number, b = false) => {
    text(page, label, 470, y, { right: true, f: b ? bold : font, color: b ? undefined : grey });
    text(page, rs(paise), 547, y, { right: true, f: b ? bold : font });
    y -= 14;
  };
  sum("Subtotal", toPaise(order.subtotal));
  if (toPaise(order.discount) > 0) sum(`Discount${order.couponCode ? ` (${order.couponCode})` : ""}`, -toPaise(order.discount));
  sum("Shipping", toPaise(order.shipping));
  if (toPaise(order.codCharge) > 0) sum("COD charge", toPaise(order.codCharge));
  sum("Total", toPaise(order.total), true);
  if (toPaise(order.taxTotal) > 0) {
    const tax = toPaise(order.taxTotal);
    const intra = business.stateOfSupply && business.stateOfSupply.toLowerCase() === order.shipState.toLowerCase();
    text(page, intra ? `Includes CGST ${rs(Math.floor(tax / 2))} + SGST ${rs(tax - Math.floor(tax / 2))}` : `Includes IGST ${rs(tax)}`, 547, y, { right: true, color: grey, size: 8.5 });
    y -= 14;
  }
  text(page, `Amount received: ${rs(toPaise(order.amountPaid))}`, 547, y, { right: true, color: grey, size: 8.5 });

  if (business.invoiceFooter) text(page, business.invoiceFooter.slice(0, 140), 48, 60, { color: grey, size: 8.5 });
  text(page, "This is a computer-generated invoice.", 48, 46, { color: grey, size: 8 });
  return pdf.save();
}
