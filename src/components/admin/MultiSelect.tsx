"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type Option = { value: string; label: string };

/**
 * Replacement for a native <select multiple>, which is unreadable and needs
 * ctrl-click to use. Renders the chosen items as chips and submits them as
 * hidden inputs, so the server still reads them with form.getAll(name).
 */
export function MultiSelect({
  name,
  label,
  options,
  defaultValue = [],
  placeholder = "Any",
  hint,
  searchable,
}: {
  name: string;
  label: string;
  options: Option[];
  defaultValue?: string[];
  placeholder?: string;
  hint?: string;
  /** Defaults to on once the list is long enough to need it. */
  searchable?: boolean;
}) {
  const [selected, setSelected] = useState<string[]>(defaultValue);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const box = useRef<HTMLDivElement>(null);
  const listId = useId();
  const withSearch = searchable ?? options.length > 8;

  useEffect(() => {
    if (!open) return;
    function onDocPointerDown(e: PointerEvent) {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onDocPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDocPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const byValue = useMemo(() => new Map(options.map((o) => [o.value, o.label])), [options]);
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? options.filter((o) => o.label.toLowerCase().includes(q)) : options;
  }, [options, query]);

  const toggle = (value: string) => setSelected((s) => (s.includes(value) ? s.filter((v) => v !== value) : [...s, value]));

  return (
    <div ref={box} className="relative">
      <span className="field-label">{label}</span>
      {selected.map((v) => <input key={v} type="hidden" name={name} value={v} />)}

      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={listId}
        className={cn(
          "flex min-h-[46px] w-full items-center justify-between gap-2 rounded-[14px] border bg-white px-3 py-2 text-left transition",
          open ? "border-leaf-500 shadow-[0_0_0_4px_rgb(76_154_63/0.15)]" : "border-cream-200 hover:border-forest-800",
        )}
      >
        {selected.length ? (
          <span className="flex flex-wrap gap-1.5">
            {selected.map((v) => (
              <span key={v} className="inline-flex items-center gap-1 rounded-full bg-botanical-100 py-1 pl-2.5 pr-1 text-[12px] text-forest-800">
                {byValue.get(v) ?? v}
                <span
                  role="button"
                  tabIndex={-1}
                  aria-label={`Remove ${byValue.get(v) ?? v}`}
                  onClick={(e) => { e.stopPropagation(); toggle(v); }}
                  className="grid size-4 cursor-pointer place-items-center rounded-full text-forest-800/60 transition hover:bg-white hover:text-danger-600"
                >
                  <X className="size-3" />
                </span>
              </span>
            ))}
          </span>
        ) : (
          <span className="text-[15px] text-ink-500">{placeholder}</span>
        )}
        <ChevronDown className={cn("size-4 shrink-0 text-ink-500 transition-transform duration-200", open && "rotate-180")} />
      </button>
      {hint && <p className="mt-1 text-xs text-ink-500">{hint}</p>}

      {open && (
        <div
          id={listId}
          className="absolute left-0 right-0 top-[calc(100%+6px)] z-30 origin-top overflow-hidden rounded-[18px] border border-cream-200 bg-white shadow-[0_28px_60px_-30px_rgba(18,61,34,0.55)] motion-safe:animate-[tour-pop_0.16s_var(--ease-out-soft)]"
        >
          {withSearch && (
            <div className="flex items-center gap-2 border-b border-cream-100 px-3 py-2">
              <Search className="size-3.5 shrink-0 text-ink-500" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Type to filter…"
                aria-label={`Filter ${label}`}
                className="w-full bg-transparent py-1 text-sm outline-none placeholder:text-ink-500/70"
              />
            </div>
          )}
          <ul className="max-h-60 overflow-y-auto p-1.5">
            {visible.length ? (
              visible.map((o) => {
                const on = selected.includes(o.value);
                return (
                  <li key={o.value}>
                    <button
                      type="button"
                      onClick={() => toggle(o.value)}
                      aria-pressed={on}
                      className={cn(
                        "flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-[13px] transition",
                        on ? "bg-botanical-100/70 text-forest-900" : "text-ink-700 hover:bg-ivory-50",
                      )}
                    >
                      <span className={cn("grid size-4 shrink-0 place-items-center rounded-[5px] border transition", on ? "border-forest-800 bg-forest-800 text-ivory-50" : "border-cream-200")}>
                        {on && <Check className="size-3" strokeWidth={3} />}
                      </span>
                      {o.label}
                    </button>
                  </li>
                );
              })
            ) : (
              <li className="px-3 py-6 text-center text-xs text-ink-500">Nothing matches “{query}”.</li>
            )}
          </ul>
          <div className="flex items-center justify-between border-t border-cream-100 px-3 py-2 text-xs">
            <span className="text-ink-500">{selected.length ? `${selected.length} selected` : "None selected"}</span>
            <span className="flex gap-3">
              {selected.length > 0 && (
                <button type="button" onClick={() => setSelected([])} className="text-ink-500 underline-offset-2 hover:text-danger-600 hover:underline">Clear</button>
              )}
              <button type="button" onClick={() => setOpen(false)} className="font-medium text-green-600 underline-offset-2 hover:underline">Done</button>
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
