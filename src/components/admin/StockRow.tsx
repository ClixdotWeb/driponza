"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { StockAdjustButton } from "@/components/admin/Forms";
import { cn } from "@/lib/utils";

export type StockRowData = {
  variantId: string;
  productId: string;
  name: string;
  label: string;
  sku: string;
  stock: number;
  reserved: number;
  damaged: number;
  lowAt: number;
  hidden: boolean;
  cost: string | null;
};

/**
 * A row of the stock table. The number is held in client state so an addition
 * shows the instant it is submitted, rather than after the server round trip;
 * when the re-rendered page arrives the real figure takes over again.
 */
export function StockRow({ row, canManage }: { row: StockRowData; canManage: boolean }) {
  const [pending, setPending] = useState<number | null>(null);

  // The server's number is the truth: as soon as it arrives, drop the guess.
  useEffect(() => setPending(null), [row.stock]);

  const stock = pending ?? row.stock;
  const saving = pending !== null;
  const out = stock <= 0;
  const low = !out && stock <= row.lowAt;

  return (
    <tr>
      <td>
        <div className="flex items-start gap-3">
          <span aria-hidden="true" className={cn("mt-1 h-8 w-1 shrink-0 rounded-full transition-colors", out ? "bg-danger-600" : low ? "bg-warning-500" : "bg-leaf-300")} />
          <div className="min-w-0">
            <Link href={`/admin/products/${row.productId}`} className="font-medium text-forest-800 hover:underline">{row.name}</Link>
            <span className="mt-0.5 block text-xs text-ink-500">
              {row.label} · <span className="font-mono">{row.sku}</span>
              {row.hidden && " · hidden"}
              {row.cost && ` · cost ${row.cost}`}
            </span>
          </div>
        </div>
      </td>
      <td>
        <span className={cn("display block text-[1.7rem] leading-none tabular-nums transition-opacity", out ? "text-danger-600" : low ? "text-warning-500" : "text-forest-900", saving && "opacity-60")}>
          {stock}
        </span>
        <span className={cn("mt-1.5 inline-block rounded-full px-2 py-0.5 text-[11px]", out ? "bg-danger-600/10 text-danger-600" : low ? "bg-warning-500/15 text-[#8a5a00]" : "bg-botanical-100 text-green-600")}>
          {saving ? "Saving…" : out ? "Out of stock" : low ? `Low · reorder at ${row.lowAt}` : "In stock"}
        </span>
      </td>
      <td className="tabular-nums">{row.reserved ? <span className="text-ink-700">{row.reserved}</span> : <span className="text-ink-500/50">—</span>}</td>
      <td className="tabular-nums">{row.damaged ? <span className="text-danger-600">{row.damaged}</span> : <span className="text-ink-500/50">—</span>}</td>
      {canManage && (
        <td className="text-right">
          <StockAdjustButton
            variantId={row.variantId}
            name={row.name}
            label={row.label}
            onAdd={(n) => setPending(stock + n)}
            onFail={() => setPending(null)}
          />
        </td>
      )}
    </tr>
  );
}
