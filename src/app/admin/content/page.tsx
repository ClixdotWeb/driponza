import { AdminHeader, Panel } from "@/components/admin/ui";
import { CommerceForm, ContactForm, ContentForm, FeaturedManager, PoliciesForm } from "@/components/admin/SettingsForms";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";

export const metadata = { title: "Content & settings" };

export default async function ContentPage() {
  const [settings, products] = await Promise.all([
    getSettings(),
    db.product.findMany({ where: { isActive: true }, orderBy: [{ isFeatured: "desc" }, { featuredOrder: "asc" }, { name: "asc" }], select: { id: true, name: true, isFeatured: true, featuredOrder: true } }),
  ]);
  return (
    <>
      <AdminHeader title="Content & settings" description="Edit homepage text, contact details, shipping and policies. Changes go live immediately." />
      <div className="grid gap-6">
        <Panel title="Homepage featured products"><FeaturedManager products={products} /></Panel>
        <Panel title="Homepage & brand text"><ContentForm content={settings.content} /></Panel>
        <Panel title="Contact details"><ContactForm contact={settings.contact} /></Panel>
        <Panel title="Shipping & payment options"><CommerceForm commerce={settings.commerce} /></Panel>
        <Panel title="Policies"><PoliciesForm policies={settings.policies} /></Panel>
      </div>
    </>
  );
}
