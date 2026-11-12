"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { launchRazorpay } from "@/components/store/CheckoutClient";
import { cancelOrderAction, retryPaymentAction } from "@/server/actions/checkout";

export function OrderActions({ number, canPay, canCancel, paid }: { number: string; canPay: boolean; canCancel: boolean; paid: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  if (!canPay && !canCancel) return null;

  return (
    <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-cream-200 pt-6">
      {canPay && (
        <button
          className="btn btn-primary"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setMessage(null);
            const res = await retryPaymentAction(number);
            if (!res.ok || !res.razorpay) {
              setBusy(false);
              setMessage(res.ok ? "Payment unavailable." : res.error);
              return;
            }
            await launchRazorpay(res.razorpay, (r) => {
              setBusy(false);
              if (!r.ok) setMessage(r.message ?? "Payment not completed.");
              router.refresh();
            });
          }}
        >
          {busy ? "Opening payment…" : "Complete payment"}
        </button>
      )}
      {canCancel && (
        <button
          className="btn btn-outline text-danger-600"
          disabled={busy}
          onClick={async () => {
            if (!confirm(paid ? "Request cancellation? We'll refund your payment once approved." : "Cancel this order?")) return;
            setBusy(true);
            const res = await cancelOrderAction(number);
            setBusy(false);
            setMessage(res.message);
            router.refresh();
          }}
        >
          {paid ? "Request cancellation" : "Cancel order"}
        </button>
      )}
      {message && <p className="w-full text-sm text-ink-700">{message}</p>}
    </div>
  );
}
