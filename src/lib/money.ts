// All arithmetic is done in integer paise to avoid floating point errors.
type DecimalLike = { toString(): string } | number | string | null | undefined;

export function toPaise(value: DecimalLike): number {
  if (value === null || value === undefined) return 0;
  const [whole, frac = ""] = value.toString().split(".");
  const sign = whole.startsWith("-") ? -1 : 1;
  const rupees = Math.abs(parseInt(whole, 10) || 0);
  const paise = parseInt((frac + "00").slice(0, 2), 10) || 0;
  return sign * (rupees * 100 + paise);
}

export function paiseToDecimalString(paise: number): string {
  const sign = paise < 0 ? "-" : "";
  const abs = Math.abs(Math.round(paise));
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
}

export function formatINR(paise: number): string {
  const rupees = paise / 100;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: paise % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(rupees);
}
