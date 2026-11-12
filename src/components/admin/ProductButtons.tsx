"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { deleteProductAction, markReviewedAction } from "@/server/actions/admin-catalog";

export function DeleteProductButton({ productId }: { productId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      className="btn btn-sm border border-danger-600/40 text-danger-600 hover:bg-danger-600/10"
      onClick={async () => {
        if (!confirm("Delete this product? Products with orders are archived instead.")) return;
        setBusy(true);
        const res = await deleteProductAction(productId);
        alert(res.message);
        router.push("/admin/products");
        router.refresh();
      }}
    >
      Delete
    </button>
  );
}

export function MarkReviewedButton({ productId }: { productId: string }) {
  const router = useRouter();
  return (
    <button type="button" className="btn btn-sm btn-primary" onClick={async () => { await markReviewedAction(productId); router.refresh(); }}>
      Mark as reviewed
    </button>
  );
}
