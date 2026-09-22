"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Settings } from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import { api, ApiError, type Product } from "@/lib/api-client";

function angka(n: number) {
  return n.toLocaleString("id-ID");
}

const TANPA_KATEGORI = "Tanpa Kategori";

/// State draft satu produk — dipisah dari `Product` supaya input bisa
/// diketik bebas (termasuk dikosongkan sebentar) tanpa langsung memvalidasi
/// tiap tombol ditekan; validasi & kirim ke server baru terjadi saat blur.
interface Draft {
  sellPrice: string;
  minimumQty: string;
  criticalQty: string;
}

function draftDariProduk(p: Product): Draft {
  return {
    sellPrice: String(p.sellPrice),
    minimumQty: String(p.minimumQty),
    criticalQty: String(p.criticalQty),
  };
}

/// Tab Pengaturan — Harga Jual & default batas Stok Menipis/Kritis per
/// produk, berlaku untuk SELURUH booth (lihat Product.minimumQty di
/// schema.prisma & BR-007). Booth tertentu yang butuh angka berbeda tetap
/// bisa dikustomisasi lewat halaman Threshold Stok Booth — nilai di sini
/// hanya dipakai sebagai fallback kalau booth itu belum mengustomisasi.
///
/// Model edit "langsung update di tabel": tiap sel disimpan sendiri-sendiri
/// saat blur (bukan lewat tombol Simpan terpisah), supaya perubahan satu
/// baris tidak menunggu baris lain selesai diketik.
export function TabPengaturan({
  products,
  onReload,
}: {
  products: Product[];
  onReload: () => Promise<void>;
}) {
  const toast = useToast();
  const [drafts, setDrafts] = useState<Map<string, Draft>>(new Map());
  const [savingId, setSavingId] = useState<string | null>(null);

  // Draft disinkronkan ulang tiap `products` berubah (reload dari server) —
  // tapi baris yang sedang aktif diedit TIDAK ditimpa, supaya ketikan yang
  // belum di-blur tidak hilang saat baris lain barusan selesai disimpan.
  useEffect(() => {
    setDrafts((prev) => {
      const next = new Map(prev);
      for (const p of products) {
        if (!next.has(p.id)) next.set(p.id, draftDariProduk(p));
      }
      for (const id of Array.from(next.keys())) {
        if (!products.some((p) => p.id === id)) next.delete(id);
      }
      return next;
    });
  }, [products]);

  const kelompok = useMemo(() => {
    const perKategori = new Map<string, Product[]>();
    for (const p of products) {
      const kunci = p.category ?? TANPA_KATEGORI;
      if (!perKategori.has(kunci)) perKategori.set(kunci, []);
      perKategori.get(kunci)!.push(p);
    }
    return Array.from(perKategori.entries())
      .map(([nama, rows]) => ({ nama, rows: [...rows].sort((a, b) => a.name.localeCompare(b.name)) }))
      .sort((a, b) => {
        if (a.nama === TANPA_KATEGORI) return 1;
        if (b.nama === TANPA_KATEGORI) return -1;
        return a.nama.localeCompare(b.nama);
      });
  }, [products]);

  function setDraftField(productId: string, field: keyof Draft, value: string) {
    setDrafts((prev) => {
      const next = new Map(prev);
      const current = next.get(productId);
      if (current) next.set(productId, { ...current, [field]: value });
      return next;
    });
  }

  /// Dipanggil saat blur — cuma kirim ke server kalau angkanya benar-benar
  /// berubah dari data terakhir, supaya klik-lewat tanpa mengetik tidak
  /// memicu request percuma.
  async function simpanField(p: Product, field: keyof Draft, apiField: "sellPrice" | "minimumQty" | "criticalQty") {
    const draft = drafts.get(p.id);
    if (!draft) return;
    const parsed = Math.max(0, Math.trunc(Number(draft[field]) || 0));
    if (parsed === p[apiField]) {
      setDraftField(p.id, field, String(parsed));
      return;
    }
    setSavingId(p.id);
    try {
      await api.updateProduct(p.id, { [apiField]: parsed });
      await onReload();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : `Gagal menyimpan ${apiField} produk.`);
      setDraftField(p.id, field, String(p[apiField]));
    } finally {
      setSavingId(null);
    }
  }

  function renderBaris(p: Product) {
    const draft = drafts.get(p.id) ?? draftDariProduk(p);
    const menyimpan = savingId === p.id;
    const minimumQtyAngka = Number(draft.minimumQty) || 0;

    return (
      <tr key={p.id} className={`hover:bg-brand-50/20 dark:hover:bg-surface-hover/40 transition-colors ${!p.active ? "opacity-60" : ""}`}>
        <td className="py-2.5 px-3">
          <div className="font-bold text-slate-800 dark:text-fg">{p.name}</div>
          <div className="text-[11px] font-mono text-slate-400 dark:text-fg-muted">{p.sku}</div>
        </td>

        <td className="py-2.5 px-3 text-right">
          <div className="inline-flex items-center gap-1 rounded-lg border border-slate-200/90 dark:border-line bg-white/90 dark:bg-surface px-2.5 h-8">
            <span className="text-slate-400 dark:text-fg-muted text-xs">Rp</span>
            <input
              type="number"
              min={0}
              value={draft.sellPrice}
              onChange={(e) => setDraftField(p.id, "sellPrice", e.target.value)}
              onBlur={() => simpanField(p, "sellPrice", "sellPrice")}
              className="w-24 text-right bg-transparent text-xs font-semibold text-slate-800 dark:text-fg outline-none tabular-nums"
            />
          </div>
        </td>

        <td className="py-2.5 px-3 text-center">
          <span className="text-[11px] font-semibold text-brand-600 dark:text-brand-400" title="Dihitung otomatis: di atas batas Stok Menipis">
            &gt; {angka(minimumQtyAngka)} cup
          </span>
        </td>

        <td className="py-2.5 px-3 text-center">
          <input
            type="number"
            min={0}
            value={draft.minimumQty}
            onChange={(e) => setDraftField(p.id, "minimumQty", e.target.value)}
            onBlur={() => simpanField(p, "minimumQty", "minimumQty")}
            className="w-16 text-center rounded-lg border border-slate-200/90 dark:border-line bg-white/90 dark:bg-surface h-8 text-xs font-semibold text-slate-800 dark:text-fg outline-none tabular-nums focus:border-[var(--brand-700)]"
          />
        </td>

        <td className="py-2.5 px-3 text-center">
          <input
            type="number"
            min={0}
            value={draft.criticalQty}
            onChange={(e) => setDraftField(p.id, "criticalQty", e.target.value)}
            onBlur={() => simpanField(p, "criticalQty", "criticalQty")}
            className="w-16 text-center rounded-lg border border-slate-200/90 dark:border-line bg-white/90 dark:bg-surface h-8 text-xs font-semibold text-rose-600 dark:text-rose-400 outline-none tabular-nums focus:border-[var(--brand-700)]"
          />
        </td>

        <td className="py-2.5 px-3 text-center w-14">
          {menyimpan && (
            <span className="inline-block w-3.5 h-3.5 border-2 border-slate-300 dark:border-line border-t-[var(--brand-700)] rounded-full animate-spin" />
          )}
        </td>
      </tr>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-brand-50 dark:bg-brand-500/10 text-[var(--brand-700)] dark:text-brand-400 flex items-center justify-center flex-shrink-0 border border-brand-100 dark:border-brand-500/20 shadow-2xs">
          <Settings className="w-4.5 h-4.5" />
        </div>
        <div>
          <h1 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-fg tracking-tight leading-tight">Pengaturan</h1>
          <p className="text-xs text-slate-500 dark:text-fg-muted font-normal mt-0.5">
            Harga jual & default batas Stok Menipis/Kritis per produk, berlaku ke seluruh booth. Booth tertentu bisa
            dikustomisasi lewat halaman Threshold Stok Booth. Perubahan tersimpan otomatis.
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200/80 dark:border-line bg-white dark:bg-surface shadow-2xs overflow-x-auto">
        <table className="w-full text-xs text-left">
          <thead>
            <tr className="bg-brand-50/70 dark:bg-surface-hover/80 text-[11px] font-bold text-slate-700 dark:text-fg-secondary border-b border-slate-200/80 dark:border-line">
              <th className="py-3 px-3">Produk</th>
              <th className="py-3 px-3 text-right">Harga Jual</th>
              <th className="py-3 px-3 text-center">Stok Aman</th>
              <th className="py-3 px-3 text-center">Stok Menipis</th>
              <th className="py-3 px-3 text-center">Stok Kritis</th>
              <th className="py-3 px-3 w-14" aria-label="Status simpan" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-line">
            {products.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-10 text-slate-500 dark:text-fg-muted">
                  Belum ada Produk.
                </td>
              </tr>
            ) : (
              kelompok.map((grup) => (
                <React.Fragment key={grup.nama}>
                  <tr className="bg-slate-50 dark:bg-surface-hover/60">
                    <td colSpan={6} className="py-2 px-3">
                      <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-fg-muted">
                        {grup.nama}
                      </span>
                      <span className="ml-2 text-[11px] font-normal text-slate-400 dark:text-fg-muted">
                        · {grup.rows.length} produk
                      </span>
                    </td>
                  </tr>
                  {grup.rows.map((p) => renderBaris(p))}
                </React.Fragment>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
