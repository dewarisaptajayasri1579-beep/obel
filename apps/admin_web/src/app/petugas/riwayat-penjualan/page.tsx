"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Printer } from "lucide-react";
import { api, ApiError, type SaleListItem } from "@/lib/api-client";
import { useToast } from "@/components/ui/Toast";
import { Spinner } from "@/components/ui/Spinner";
import { RequirePetugasAuth } from "@/components/layout/RequirePetugasAuth";
import { formatRupiah, formatJamJakarta, formatTanggalJakarta } from "../_lib/format";
import { isNativeBridgeAvailable, printBaris } from "../_lib/native-bridge";
import { buatStrukPenjualan, labelMetodeBayar } from "@/lib/receipt";
import { usePerusahaan } from "@/lib/use-perusahaan";
import { GantiMetodeSheet } from "./GantiMetodeSheet";

import { OBBEL } from "../_lib/theme";
const GREEN = OBBEL.primaryDark;

type Filter = "HARI_INI" | "MINGGU_INI" | "SEMUA";

function startOfTodayJakarta(): Date {
  const now = new Date(Date.now() + 7 * 60 * 60 * 1000);
  const start = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return new Date(start - 7 * 60 * 60 * 1000);
}

function RiwayatPenjualanContent() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [sales, setSales] = useState<SaleListItem[]>([]);
  const [filter, setFilter] = useState<Filter>("HARI_INI");
  // Shift yang sedang berjalan (null kalau belum Check-In): hanya transaksi di
  // shift ini yang metode bayarnya boleh diganti Barista.
  const [shiftAktifId, setShiftAktifId] = useState<string | null>(null);
  const [qrisImageUrl, setQrisImageUrl] = useState<string | null>(null);
  const [gantiMetode, setGantiMetode] = useState<SaleListItem | null>(null);
  const [mencetakId, setMencetakId] = useState<string | null>(null);
  const perusahaan = usePerusahaan();

  /// Cetak ulang struk dari data yang tersimpan di server (bukan dari keranjang), diberi penanda
  /// CETAK ULANG supaya salinan tidak dipakai sebagai nota asli. Barista di struk = yang menjual.
  async function cetakUlang(s: SaleListItem) {
    if (!isNativeBridgeAvailable()) {
      toast.warning("Cetak ulang hanya bisa dari aplikasi Barista (printer Bluetooth).");
      return;
    }
    setMencetakId(s.id);
    try {
      await printBaris(
        buatStrukPenjualan({
          perusahaan,
          boothName: s.boothName,
          saleNo: s.saleNo,
          waktuIso: s.paidAt ?? s.createdAt,
          barista: s.staffName,
          items: s.items.map((i) => ({ name: i.productName, qty: i.qty, unitPrice: i.unitPrice, lineTotal: i.lineTotal })),
          subtotal: s.subtotal,
          discount: s.discount,
          total: s.total,
          metode: labelMetodeBayar(s.paymentMethod),
          cetakUlang: true,
        }),
      );
      toast.success("Struk dicetak ulang.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal cetak ulang. Cek printer sudah dipilih & menyala.");
    } finally {
      setMencetakId(null);
    }
  }

  function muatPenjualan() {
    return api
      .getSales({ status: "PAID", limit: 100 })
      .then((res) => setSales(res.rows))
      .catch((err) => toast.error(err instanceof ApiError ? err.message : "Gagal memuat riwayat penjualan."));
  }

  useEffect(() => {
    muatPenjualan().finally(() => setLoading(false));
    api
      .getActiveShift()
      .then(async (shift) => {
        setShiftAktifId(shift.shiftSessionId);
        const booths = await api.getBooths().catch(() => []);
        setQrisImageUrl(booths.find((b) => b.id === shift.booth.id)?.qrisImageUrl ?? null);
      })
      .catch(() => setShiftAktifId(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    if (filter === "SEMUA") return sales;
    const startToday = startOfTodayJakarta();
    const cutoff = filter === "HARI_INI" ? startToday : new Date(startToday.getTime() - 6 * 24 * 60 * 60 * 1000);
    return sales.filter((s) => {
      const at = s.paidAt ?? s.createdAt;
      return new Date(at) >= cutoff;
    });
  }, [sales, filter]);

  const totalOmzet = filtered.reduce((sum, s) => sum + s.total, 0);

  return (
    <div className="min-h-screen bg-[#F7F9F6]">
      <div className="bg-white px-5 pt-5 pb-4">
        <h1 className="text-lg font-extrabold text-slate-900">Riwayat Penjualan</h1>
      </div>

      <div className="px-4 pt-3 flex gap-2">
        {([
          ["HARI_INI", "Hari Ini"],
          ["MINGGU_INI", "Minggu Ini"],
          ["SEMUA", "Semua"],
        ] as [Filter, string][]).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setFilter(key)}
            className="flex-1 rounded-full py-2.5 text-sm font-bold"
            style={
              filter === key
                ? { backgroundColor: GREEN, color: "white" }
                : { backgroundColor: "white", color: "#475569", border: "1px solid #E2E8F0" }
            }
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Spinner />
        </div>
      ) : (
        <div className="p-4">
          <div className="rounded-2xl bg-white border border-slate-200 p-4 flex justify-between items-center mb-4">
            <div>
              <p className="text-sm text-slate-500">Total Transaksi</p>
              <p className="font-extrabold text-xl mt-0.5">{filtered.length}</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-slate-500">Total Omzet</p>
              <p className="font-extrabold text-xl mt-0.5" style={{ color: GREEN }}>
                {formatRupiah(totalOmzet)}
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-2.5">
            {filtered.length === 0 && (
              <p className="text-base text-slate-500 text-center py-10">Belum ada transaksi pada periode ini.</p>
            )}
            {filtered.map((s) => (
              <div key={s.id} className="rounded-xl bg-white border border-slate-200 p-3.5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-base text-slate-900">{s.saleNo}</p>
                    <p className="text-sm text-slate-500 mt-0.5">
                      {formatTanggalJakarta(s.paidAt ?? s.createdAt)} • {formatJamJakarta(s.paidAt ?? s.createdAt)} • {labelMetodeBayar(s.paymentMethod)}
                    </p>
                  </div>
                  <p className="font-extrabold text-base">{formatRupiah(s.total)}</p>
                </div>
                <div className="mt-2.5 flex gap-2">
                  <button
                    type="button"
                    onClick={() => cetakUlang(s)}
                    disabled={mencetakId === s.id}
                    className="flex-1 flex items-center justify-center gap-1.5 rounded-lg border border-slate-300 py-2 text-sm font-bold text-slate-600 disabled:opacity-60"
                  >
                    {mencetakId === s.id ? <Spinner size="sm" /> : <Printer size={14} />} Cetak Ulang
                  </button>
                  {s.shiftSessionId === shiftAktifId && (
                    <button
                      type="button"
                      onClick={() => setGantiMetode(s)}
                      className="flex-1 rounded-lg border py-2 text-sm font-bold"
                      style={{ borderColor: GREEN, color: GREEN }}
                    >
                      Ganti Metode Bayar
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {gantiMetode && (
        <GantiMetodeSheet
          sale={gantiMetode}
          qrisImageUrl={qrisImageUrl}
          onClose={() => setGantiMetode(null)}
          onDone={() => {
            setGantiMetode(null);
            muatPenjualan();
          }}
        />
      )}
    </div>
  );
}

export default function RiwayatPenjualanPage() {
  return (
    <RequirePetugasAuth>
      <RiwayatPenjualanContent />
    </RequirePetugasAuth>
  );
}
