"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

export type ProductRef = { id: string; name: string; code: string };

const cellClass =
  "w-full h-9 px-2.5 rounded-lg border border-slate-200 bg-white text-xs sm:text-sm shadow-2xs dark:border-line dark:bg-surface focus:border-[#0544cc] focus:outline-none";

const normalize = (value: string) => value.replace(/\s+/g, "").toUpperCase();

interface ProductCodeInputProps<T extends ProductRef> {
  value: string;
  products: T[];
  onPick: (productId: string) => void;
  /** Dipanggil setelah kode diterima (Enter/Tab) — kode yang baru dipilih dikirim langsung
   *  karena `onPick` baru menjadwalkan state, belum bisa dibaca pemanggil saat ini. */
  onAdvance: (productIdBaru?: string) => void;
  inputProps?: React.InputHTMLAttributes<HTMLInputElement>;
  /** Bagian kanan tiap baris saran — mis. harga (`PurchaseOrderForm`) atau stok gudang
   *  (`SerahTerimaBarangForm`). Opsional, kosongkan kalau tidak ada info tambahan yang relevan. */
  renderSuggestionExtra?: (product: T) => React.ReactNode;
}

/** Kolom kode produk — bukan dropdown, user ketik kode/nama langsung, saran cuma muncul kalau
 *  ketikan masih ambigu. Pola diadaptasi dari SkuInput (app-internal), dipakai grid baris item
 *  keyboard-first di semua form Transaksi dengan Detail (§7.1 aturan-tampilan.md) — extract
 *  2026-09-16 dari `pembelian/purchase-order/baru/GridCells.tsx` (acuan pertama) supaya form
 *  baru (Serah Terima Barang, dst) tidak menyalin ulang. `T` boleh bawa field tambahan
 *  (costPrice, stock, dst) — tampilkan lewat `renderSuggestionExtra`. */
export function ProductCodeInput<T extends ProductRef>({ value, products, onPick, onAdvance, inputProps, renderSuggestionExtra }: ProductCodeInputProps<T>) {
  const [text, setText] = useState(value);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const [mounted, setMounted] = useState(false);
  const [coords, setCoords] = useState<{ top?: number; bottom?: number; left: number; width: number } | null>(null);

  useEffect(() => setMounted(true), []);
  useEffect(() => setText(value), [value]);

  const matches = useMemo(() => {
    const q = normalize(text);
    if (!q) return [];
    const byCode = products.filter((p) => normalize(p.code).startsWith(q));
    const byName = q.length >= 2 ? products.filter((p) => !normalize(p.code).startsWith(q) && p.name.toUpperCase().includes(text.trim().toUpperCase())) : [];
    return [...byCode, ...byName].slice(0, 8);
  }, [text, products]);

  const place = useCallback(() => {
    const rect = inputRef.current?.getBoundingClientRect();
    if (!rect) return;
    const GAP = 4;
    const height = Math.min(matches.length * 34 + 8, 224);
    const below = window.innerHeight - rect.bottom;
    const up = below < height + GAP && rect.top > below;
    setCoords(up ? { bottom: window.innerHeight - rect.top + GAP, left: rect.left, width: rect.width } : { top: rect.bottom + GAP, left: rect.left, width: rect.width });
  }, [matches.length]);

  useEffect(() => {
    if (!open) return;
    place();
    const onMove = () => place();
    window.addEventListener("scroll", onMove, true);
    window.addEventListener("resize", onMove);
    return () => {
      window.removeEventListener("scroll", onMove, true);
      window.removeEventListener("resize", onMove);
    };
  }, [open, place]);

  const exact = useMemo(() => products.find((p) => normalize(p.code) === normalize(text)), [text, products]);

  const commit = (): string | undefined => {
    const chosen = exact ?? (open && matches[highlight]) ?? (matches.length === 1 ? matches[0] : undefined);
    if (!chosen) return undefined;
    setText(chosen.code);
    onPick(chosen.id);
    setOpen(false);
    return chosen.id;
  };

  return (
    <>
      <input
        {...inputProps}
        ref={inputRef}
        value={text}
        placeholder="Ketik kode/nama produk"
        autoComplete="off"
        spellCheck={false}
        className={`${cellClass} ${text && !exact && matches.length === 0 ? "border-rose-400" : ""}`}
        onChange={(e) => {
          setText(e.target.value);
          setOpen(true);
          setHighlight(0);
        }}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        onKeyDown={(e) => {
          inputProps?.onKeyDown?.(e);
          if (e.defaultPrevented) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setOpen(true);
            setHighlight((h) => Math.min(h + 1, matches.length - 1));
            return;
          }
          if (e.key === "ArrowUp") {
            e.preventDefault();
            setHighlight((h) => Math.max(h - 1, 0));
            return;
          }
          if (e.key === "Escape") {
            setOpen(false);
            return;
          }
          if (e.key === "Enter" || (e.key === "Tab" && !e.shiftKey)) {
            const diterima = commit();
            if (!diterima && text.trim()) {
              e.preventDefault();
              return;
            }
            e.preventDefault();
            onAdvance(diterima);
          }
        }}
      />

      {open && !exact && matches.length > 0 && mounted && coords &&
        createPortal(
          <div
            style={{ top: coords.top, bottom: coords.bottom, left: coords.left, width: Math.max(coords.width, 260) }}
            className="fixed z-1100 max-h-56 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-line dark:bg-surface"
          >
            {matches.map((p, index) => (
              <button
                key={p.id}
                type="button"
                tabIndex={-1}
                onMouseDown={(e) => {
                  e.preventDefault();
                  setText(p.code);
                  onPick(p.id);
                  setOpen(false);
                  onAdvance(p.id);
                }}
                className={`flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-xs ${
                  index === highlight ? "bg-blue-50 text-[#0544cc] dark:bg-blue-500/10" : "hover:bg-slate-50 dark:hover:bg-surface-hover"
                }`}
              >
                <span className="min-w-0 truncate">
                  <strong>{p.code}</strong> — {p.name}
                </span>
                {renderSuggestionExtra && <span className="text-[10px] text-slate-400 dark:text-fg-muted shrink-0">{renderSuggestionExtra(p)}</span>}
              </button>
            ))}
          </div>,
          document.body,
        )}
    </>
  );
}

interface NumberCellProps {
  value: number;
  onChange: (value: number) => void;
  onAdvance: () => void;
  /** Border merah — dipakai form yang perlu menandai qty melebihi batas (mis. stok gudang). */
  error?: boolean;
  inputProps?: React.InputHTMLAttributes<HTMLInputElement>;
}

/** Sel angka dengan pemisah ribuan yang terbentuk sambil mengetik (1000 -> 1.000). Posisi
 *  kursor dihitung ulang dari banyaknya ANGKA sebelum kursor (bukan jumlah huruf), supaya
 *  titik pemisah yang baru muncul tidak melompatkan kursor ke ujung. */
export function NumberCell({ value, onChange, onAdvance, error, inputProps }: NumberCellProps) {
  const ref = useRef<HTMLInputElement>(null);

  const format = (raw: string) => {
    if (!raw) return "";
    return raw.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  };

  const display = value ? format(String(Math.round(value))) : "";

  return (
    <input
      {...inputProps}
      ref={ref}
      inputMode="numeric"
      autoComplete="off"
      className={`${cellClass} ${error ? "border-rose-400 focus:border-rose-400" : ""}`}
      value={display}
      onFocus={(e) => requestAnimationFrame(() => e.target.select())}
      onChange={(e) => {
        const el = e.target;
        const before = el.value.slice(0, el.selectionStart ?? 0);
        const digitsBefore = (before.match(/\d/g) ?? []).length;
        const raw = el.value.replace(/[^\d]/g, "");
        const next = Number(raw) || 0;
        onChange(Math.max(0, next));

        const formatted = format(raw);
        requestAnimationFrame(() => {
          if (!ref.current) return;
          let seen = 0,
            pos = 0;
          for (; pos < formatted.length && seen < digitsBefore; pos++) {
            if (/\d/.test(formatted[pos])) seen++;
          }
          ref.current.setSelectionRange(pos, pos);
        });
      }}
      onKeyDown={(e) => {
        inputProps?.onKeyDown?.(e);
        if (e.defaultPrevented) return;
        if (e.key === "Enter" || (e.key === "Tab" && !e.shiftKey)) {
          e.preventDefault();
          onAdvance();
        }
      }}
    />
  );
}
