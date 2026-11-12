import { AdminHeader, Panel } from "@/components/admin/ui";
import { BankForm, BusinessForm, CommerceForm } from "@/components/admin/SettingsForms";
import { requirePermission } from "@/lib/auth/session";
import { getSettings } from "@/lib/settings";
import { emailConfigured } from "@/lib/email";
import { storageMode } from "@/lib/storage";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  await requirePermission("settings.manage");
  const settings = await getSettings();
  const integrations = [
    { label: "Online payment gateway", value: "Not integrated – the business will arrange its bank gateway separately" },
    { label: "Email provider", value: emailConfigured() ? "SMTP configured" : "Not configured – emails are logged only" },
    { label: "Image storage", value: storageMode() === "s3" ? "Coolify MinIO / S3" : storageMode() === "blob" ? "Vercel Blob (fallback until S3_* is set)" : storageMode() },
    { label: "Courier API", value: "Not integrated – shipments and tracking are entered manually" },
  ];
  return (
    <>
      <AdminHeader title="Settings" description="Payments, bank details, order rules and invoice details. Changes apply immediately and are recorded in the audit log." />
      <div className="grid gap-6">
        <Panel title="Payments & order rules"><CommerceForm commerce={settings.commerce} /></Panel>
        <Panel title="Bank account for transfers"><BankForm bank={settings.bank} /></Panel>
        <Panel title="Business & invoices"><BusinessForm business={settings.business} /></Panel>
        <Panel title="Integrations">
          <dl className="grid gap-2 text-sm">
            {integrations.map((i) => (
              <div key={i.label} className="flex flex-wrap justify-between gap-2 rounded-2xl bg-[#f4f5f2] px-4 py-3">
                <dt className="font-medium">{i.label}</dt>
                <dd className="text-ink-700">{i.value}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 text-xs text-ink-500">Credentials are environment variables (see docs/ENVIRONMENT_SETUP.md) and are never shown here.</p>
        </Panel>
      </div>
    </>
  );
}
