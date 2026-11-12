import { AdminHeader, Panel } from "@/components/admin/ui";
import { ContactForm, ContentForm, FeaturedManager, PoliciesForm } from "@/components/admin/SettingsForms";
import { FaqManager } from "@/components/admin/FaqManager";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth/session";
import { getSettings } from "@/lib/settings";

export const metadata = { title: "Content" };

export default async function ContentPage() {
  await requirePermission("content.manage");
  const [settings, products, faqs] = await Promise.all([
    getSettings(),
    db.product.findMany({ where: { isActive: true }, orderBy: [{ isFeatured: "desc" }, { featuredOrder: "asc" }, { name: "asc" }], select: { id: true, name: true, isFeatured: true, featuredOrder: true } }),
    db.faqItem.findMany({ orderBy: { position: "asc" } }),
  ]);
  return (
    <>
      <AdminHeader title="Content" description="Homepage text, featured products, FAQ, contact details and policies. Changes go live immediately." />
      <div className="grid gap-6">
        <Panel title="Homepage featured products"><FeaturedManager products={products} /></Panel>
        <Panel title="Homepage & brand text"><ContentForm content={settings.content} /></Panel>
        <Panel title="FAQ"><FaqManager items={faqs.map((f) => ({ id: f.id, question: f.question, answer: f.answer, position: f.position, isPublished: f.isPublished }))} /></Panel>
        <Panel title="Contact details"><ContactForm contact={settings.contact} /></Panel>
        <Panel title="Policies"><PoliciesForm policies={settings.policies} /></Panel>
      </div>
    </>
  );
}
