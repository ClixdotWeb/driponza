"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { ArrowDown, ArrowUp, ImageIcon, Trash2, Upload } from "lucide-react";
import { FormSection } from "@/components/admin/ui";
import { deleteImageAction, moveImageAction, updateImageAltAction } from "@/server/actions/admin-catalog";

export function ImageManager({ productId, images }: { productId: string; images: { id: string; url: string; alt: string }[] }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    setErrors([]);
    const form = new FormData();
    form.append("productId", productId);
    Array.from(files).forEach((f) => form.append("files", f));
    const res = await fetch("/api/admin/upload", { method: "POST", body: form });
    const json = (await res.json().catch(() => ({}))) as { errors?: string[]; error?: string };
    setErrors(json.errors ?? (json.error ? [json.error] : []));
    setBusy(false);
    if (input.current) input.current.value = "";
    router.refresh();
  }

  return (
    <FormSection
      icon={<ImageIcon className="size-4" />}
      title="Images"
      description="JPEG, PNG, WebP or AVIF, up to 8 MB each. The first image is the main image."
      actions={
        <label className="btn btn-primary btn-sm cursor-pointer">
          <Upload className="size-3.5" /> {busy ? "Uploading…" : "Upload images"}
          <input ref={input} type="file" accept="image/jpeg,image/png,image/webp,image/avif" multiple className="sr-only" disabled={busy} onChange={(e) => upload(e.target.files)} />
        </label>
      }
    >
      {errors.length > 0 && <ul className="mb-4 rounded-xl bg-danger-600/10 p-3 text-sm text-danger-600">{errors.map((e) => <li key={e}>{e}</li>)}</ul>}
      {images.length ? (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {images.map((img, i) => (
            <li key={img.id} className="overflow-hidden rounded-xl border border-cream-200">
              <div className="relative aspect-square bg-cream-100">
                <Image src={img.url} alt={img.alt} fill sizes="200px" className="object-cover" />
                {i === 0 && <span className="absolute left-2 top-2 rounded-full bg-forest-800 px-2 py-0.5 text-[10px] text-ivory-50">Main</span>}
              </div>
              <div className="p-2">
                <input
                  defaultValue={img.alt}
                  aria-label="Alt text"
                  placeholder="Alt text"
                  className="field-input px-2 py-1 text-xs"
                  onBlur={(e) => e.target.value !== img.alt && updateImageAltAction(img.id, e.target.value)}
                />
                <div className="mt-2 flex justify-between">
                  <div className="flex gap-1">
                    <button type="button" aria-label="Move earlier" disabled={i === 0} className="grid size-7 place-items-center rounded-full hover:bg-cream-100 disabled:opacity-30" onClick={async () => { await moveImageAction(img.id, -1); router.refresh(); }}>
                      <ArrowUp className="size-3.5" />
                    </button>
                    <button type="button" aria-label="Move later" disabled={i === images.length - 1} className="grid size-7 place-items-center rounded-full hover:bg-cream-100 disabled:opacity-30" onClick={async () => { await moveImageAction(img.id, 1); router.refresh(); }}>
                      <ArrowDown className="size-3.5" />
                    </button>
                  </div>
                  <button type="button" aria-label="Delete image" className="grid size-7 place-items-center rounded-full text-danger-600 hover:bg-danger-600/10" onClick={async () => { if (confirm("Delete this image?")) { await deleteImageAction(img.id); router.refresh(); } }}>
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-xl border border-dashed border-cream-200 p-8 text-center text-sm text-ink-500">No images yet.</p>
      )}
    </FormSection>
  );
}
