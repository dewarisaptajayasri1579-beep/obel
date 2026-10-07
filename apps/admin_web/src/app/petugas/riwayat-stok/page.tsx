"use client";

import React, { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, ChevronDown, Download, Equal, Package } from "lucide-react";
import { api, ApiError, type Product, type StockLedgerResponse } from "@/lib/api-client";
import { useToast } from "@/components/ui/Toast";
import { Spinner } from "@/components/ui/Spinner";
import { RequirePetugasAuth } from "@/components/layout/RequirePetugasAuth";
import { RequireActiveShift, useActiveShift } from "../_components/RequireActiveShift";
import { formatTanggalJakarta, formatJamJakarta } from "../_lib/format";
import { shareFile } from "../_lib/native-bridge";
import { OBBEL, OBBEL_SCALE } from "../_lib/theme";

const GREEN = OBBEL.primaryDark;

type Periode = "HARI_INI" | "7_HARI" | "30_HARI" | "BULAN_INI";

const PERIODE_LABEL: Record<Periode, string> = {
  HARI_INI: "Hari Ini",
  "7_HARI": "7 Hari Terakhir",
  "30_HARI": "30 Hari Terakhir",
  BULAN_INI: "Bulan Ini",
};

/// Rentang tanggal utk dropdown "Periode". Backend (`rinciUntukBooth`) sendiri sudah menormalkan ke
/// granularitas hari, jadi cukup kirim timestamp `from`/`to` apa adanya.
function rentangPeriode(preset: Periode): { from: string; to: string } {
  const now = new Date();
  let from: Date;
  switch (preset) {
    case "HARI_INI":
      from = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      break;
    case "30_HARI":
      from = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
    case "BULAN_INI":
      from = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    default:
      from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  }
  return { from: from.toISOString(), to: now.toISOString() };
}

/// Riwayat mutasi stok satu produk di Booth Barista. Halaman sendiri (bukan tab di halaman Stok) supaya
/// ketiga isi menu Riwayat berbentuk sama: judul polos tanpa tombol kembali, bottom nav dengan tab
/// Riwayat menyala.
function RiwayatStokContent() {
  const toast = useToast();
  const shift = useActiveShift();
  const [products, setProducts] = useState<Product[]>([]);
  const [productId, setProductId] = useState<string | null>(null);
  const [periode, setPeriode] = useState<Periode>("7_HARI");
  const [ledger, setLedger] = useState<StockLedgerResponse | null>(null);
  const [memuat, setMemuat] = useState(true);
  const [mengekspor, setMengekspor] = useState(false);

  useEffect(() => {
    api
      .getProducts()
      .then((list) => {
        const aktif = list.filter((p) => p.active);
        setProducts(aktif);
        if (aktif.length === 0) setMemuat(false);
        else setProductId((id) => id ?? aktif[0].id);
      })
      .catch((err) => {
        toast.error(err instanceof ApiError ? err.message : "Gagal memuat daftar produk.");
        setMemuat(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!productId) return;
    setMemuat(true);
    const { from, to } = rentangPeriode(periode);
    api
      .getMyStockLedger({ productId, from, to })
      .then(setLedger)
      .catch((err) => toast.error(err instanceof ApiError ? err.message : "Gagal memuat riwayat stok."))
      .finally(() => setMemuat(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId, periode]);

  async function handleExport() {
    if (!ledger || !productId) return;
    setMengekspor(true);
    try {
      const { from, to } = rentangPeriode(periode);
      const blob = await api.getMyStockLedgerExcel({ productId, from, to });
      const namaFile = `riwayat-stok-${ledger.product.name}.xlsx`;
      if (await shareFile(blob, namaFile)) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = namaFile;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Gagal mengekspor Excel.");
    } finally {
      setMengekspor(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#F7F9F6]">
      <div className="bg-white px-5 pt-5 pb-4">
        <h1 className="text-lg font-extrabold text-slate-900">Riwayat Stok</h1>
        <p className="text-sm text-slate-500 mt-1">Stok masuk dan keluar {shift.booth.name}.</p>
      </div>

      <div className="p-4">
        <div className="grid grid-cols-2 gap-2.5 mb-4">
          <div>
            <p className="text-sm font-semibold text-slate-500 mb-1">Pilih Stok</p>
            <div className="relative">
              <select
                value={productId ?? ""}
                onChange={(e) => setProductId(e.target.value)}
                className="w-full appearance-none rounded-xl border border-slate-200 bg-white pl-3 pr-8 py-3 text-base font-semibold text-slate-800"
              >
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-500 mb-1">Periode</p>
            <div className="relative">
              <select
                value={periode}
                onChange={(e) => setPeriode(e.target.value as Periode)}
                className="w-full appearance-none rounded-xl border border-slate-200 bg-white pl-3 pr-8 py-3 text-base font-semibold text-slate-800"
              >
                {(Object.keys(PERIODE_LABEL) as Periode[]).map((p) => (
                  <option key={p} value={p}>
                    {PERIODE_LABEL[p]}
                  </option>
                ))}
              </select>
              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>
          </div>
        </div>

        {memuat ? (
          <div className="flex items-center justify-center py-16">
            <Spinner />
          </div>
        ) : !ledger ? (
          <p className="text-base text-slate-500 text-center py-10">Belum ada produk untuk ditampilkan.</p>
        ) : (
          <>
            <div className="grid grid-cols-4 gap-2 mb-5">
              {(
                [
                  ["Stok Awal", ledger.ringkasan.stokAwal, Package, "#475569", "white"],
                  ["Masuk", ledger.ringkasan.masuk, ArrowUp, GREEN, OBBEL_SCALE[50]],
                  ["Keluar", ledger.ringkasan.keluar, ArrowDown, "#D21919", "#FEE2E2"],
                  ["Stok Akhir", ledger.ringkasan.stokAkhir, Package, "#475569", "white"],
                ] as [string, number, typeof Package, string, string][]
              ).map(([label, nilai, Icon, warna, latar]) => (
                <div key={label} className="rounded-xl p-2.5 border border-slate-200" style={{ backgroundColor: latar }}>
                  <Icon size={15} style={{ color: warna }} />
                  <p className="text-xs mt-1.5" style={{ color: warna }}>{label}</p>
                  <p className="text-base font-extrabold" style={{ color: warna === "#475569" ? "#0F172A" : warna }}>
                    {nilai} <span className="text-[11px] font-semibold text-slate-400">cup</span>
                  </p>
                </div>
              ))}
            </div>

            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="min-w-0">
                <p className="text-base font-extrabold text-slate-900">Riwayat Mutasi Stok</p>
                <p className="text-sm text-slate-500">Catatan masuk dan keluar stok produk terpilih</p>
              </div>
              <button
                type="button"
                onClick={handleExport}
                disabled={mengekspor || ledger.rows.length === 0}
                className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 shrink-0 disabled:opacity-50"
              >
                {mengekspor ? <Spinner size="sm" /> : <Download size={13} />}
                {mengekspor ? "Menyiapkan..." : "Excel"}
              </button>
            </div>

            <div className="flex flex-col gap-2">
              {ledger.rows.length === 0 ? (
                <p className="text-base text-slate-500 text-center py-10">Belum ada mutasi pada periode ini.</p>
              ) : (
                ledger.rows
                  .slice()
                  .reverse()
                  .map((r) => {
                    const jenis =
                      r.jenis === "MASUK"
                        ? { bg: OBBEL_SCALE[50], fg: GREEN, Icon: ArrowUp, label: "Masuk" }
                        : r.jenis === "KELUAR"
                          ? { bg: "#FEE2E2", fg: "#D21919", Icon: ArrowDown, label: "Keluar" }
                          : { bg: "#E1EEFB", fg: "#1D63D8", Icon: Equal, label: "Penyesuaian" };
                    const JenisIcon = jenis.Icon;
                    return (
                      <div key={r.id} className="rounded-2xl bg-white border border-slate-200 p-3.5">
                        <div className="flex items-start gap-3">
                          <span
                            className="flex items-center gap-1 text-xs font-bold rounded-full px-2 py-1 shrink-0"
                            style={{ backgroundColor: jenis.bg, color: jenis.fg }}
                          >
                            <JenisIcon size={11} />
                            {jenis.label}
                          </span>
                          <p className="flex-1 min-w-0 text-sm font-semibold text-slate-800 wrap-break-word">{r.keterangan}</p>
                          <p className="text-lg font-extrabold leading-none shrink-0" style={{ color: jenis.fg }}>
                            {r.qty > 0 ? "+" : ""}
                            {r.qty}
                          </p>
                        </div>
                        <div className="flex items-center justify-between mt-2.5 text-xs text-slate-400">
                          <span>
                            {formatTanggalJakarta(r.tanggal)} · {formatJamJakarta(r.tanggal)}
                          </span>
                          <span>
                            Sisa <span className="font-bold text-slate-600">{r.stokAkhir} cup</span>
                          </span>
                        </div>
                      </div>
                    );
                  })
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function RiwayatStokPage() {
  return (
    <RequirePetugasAuth>
      <RequireActiveShift title="Riwayat Stok">
        <RiwayatStokContent />
      </RequireActiveShift>
    </RequirePetugasAuth>
  );
}
