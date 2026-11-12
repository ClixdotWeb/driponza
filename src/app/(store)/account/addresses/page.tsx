import type { Metadata } from "next";
import { AddressBook } from "@/components/store/AccountForms";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { INDIAN_STATES } from "@/server/validation";

export const metadata: Metadata = { title: "Addresses", robots: { index: false } };

export default async function AddressesPage() {
  const user = await requireUser("/account/addresses");
  const addresses = await db.address.findMany({ where: { userId: user.id }, orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }] });
  return (
    <div>
      <h2 className="display mb-6 text-3xl">Saved addresses</h2>
      <AddressBook
        states={[...INDIAN_STATES]}
        addresses={addresses.map((a) => ({ id: a.id, label: a.label, fullName: a.fullName, phone: a.phone, line1: a.line1, line2: a.line2, landmark: a.landmark, city: a.city, district: a.district, state: a.state, pincode: a.pincode, isDefault: a.isDefault }))}
      />
    </div>
  );
}
