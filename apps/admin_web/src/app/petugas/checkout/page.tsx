"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Clock } from "lucide-react";
import { api, ApiError, type ActiveShift, type ShiftReport, type ClosingItem } from "@/lib/api-client";
import { useToast } from "@/components/ui/Toast";
import { Spinner } from "@/components/ui/Spinner";
import { RequirePetugasAuth } from "@/components/layout/RequirePetugasAuth";
import { useHidePetugasNav } from "@/components/layout/PetugasShell";
import { TopBar } from "../_components/TopBar";
import { AttendanceCapture, type LocationValue } from "../_components/AttendanceCapture";
import { formatRupiah, formatTanggalJakarta, formatJamJakarta, formatDurasi } from "../_lib/format";

import { OBBEL } from "../_lib/theme";
const GREEN = OBBEL.primaryDark;

type Step = "LAPORAN" | "ABSEN";

/// Gabungan ShiftReportItem (stokAwal/restock/terjual/retur/sisaSistem) +
/// ClosingItem (expectedQty/actualQty) per produk — dua sumber data yang
/// sebelumnya dua LAYAR terpisah ("Laporan" lalu "Hitung Stok"), sekarang
/// digabung jadi SATU tabel di layar Laporan Kembali sesuai mockup
/// docsV2/mockupv2-android/3. Riwayat Absen.png (kolom 2). `sisaSistem` dari
/// report dan `expectedQty` dari closing itu angka yang SAMA (keduanya baca
/// BoothStock.qtyOnHand di saat yang hampir bersamaan), jadi aman disatukan.
interface BarisClosing {
  productId: string;
  productName: string;
  stokAwal: number;
  restock: number;
  terjual: number;
  retur: number;
  sisaSistem: number;
}

function CheckoutContent() {
  const router = useRouter();
  const toast = useToast();
  useHidePetugasNav();

  const [loading, setLoading] = useState(true);
  const [shift, setShift] = useState<ActiveShift | null>(null);
  const [report, setReport] = useState<ShiftReport | null>(null);
  const [step, setStep] = useState<Step>("LAPORAN");
  const [baris, setBaris] = useState<BarisClosing[]>([]);
  const [stokFisik, setStokFisik] = useState<Record<string, number>>({});
  const [catatan, setCatatan] = useState("");
  const [location, setLocation] = useState<LocationValue | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [sekarang, setSekarang] = useState(new Date());

  useEffect(() => {
    (async () => {
      try {
        const active = await api.getActiveShift();
        setShift(active);
        const [rpt, closing] = await Promise.all([
          api.getShiftReport(active.shiftSessionId),
          api.startClosing(active.shiftSessionId),
        ]);
        setReport(rpt);
        const closingByProduct = new Map<string, ClosingItem>(closing.items.map((i) => [i.productId, i]));
        setBaris(
          rpt.items.map((it) => ({
            productId: it.productId,
            productName: it.productName,
            stokAwal: it.stokAwal,
            restock: it.restock,
            terjual: it.terjual,
            retur: it.retur,
            sisaSistem: closingByProduct.get(it.productId)?.expectedQty ?? it.sisaSistem,
          })),
        );
        setStokFisik(
          Object.fromEntries(
            rpt.items.map((it) => [it.productId, closingByProduct.get(it.productId)?.actualQty ?? it.sisaSistem]),
          ),
        );
      } catch (err) {
        toast.error(err instanceof ApiError ? err.message : "Gagal memuat laporan shift.");
      } finally {
        setLoading(false);
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    })();
  }, []);

  // "Jam Sekarang" & "Durasi Kerja" di Ringkasan Shift ikut berjalan selama
  // layar Check Out terbuka, bukan angka beku sejak halaman dimuat.
  useEffect(() => {
    if (step !== "ABSEN") return;
    const t = setInterval(() => setSekarang(new Date()), 30_000);
    return () => clearInterval(t);
  }, [step]);

  const adaSelisih = baris.some((b) => (stokFisik[b.productId] ?? b.sisaSistem) !== b.sisaSistem);
  const catatanTerisi = !adaSelisih || catatan.trim().length > 0;

  function lanjutCheckOut() {
    if (!catatanTerisi) {
      toast.warning("Ada selisih Stok Fisik — isi Catatan dulu sebelum lanjut.");
      return;
    }
    setStep("ABSEN");
  }

  async function handleConfirmCheckout() {
    if (!shift || !location || !photoFile) return;
    setSubmitting(true);
    try {
      const { photoUrl } = await api.uploadAttendancePhoto(photoFile);
      const result = await api.confirmClosing(shift.shiftSessionId, {
        items: baris.map((b) => {
          const actualQty = stokFisik[b.productId] ?? b.sisaSistem;
          return {
            productId: b.productId,
            actualQty,
            ...(actualQty !== b.sisaSistem
              ? { reasonCode: "WRONG_PHYSICAL_COUNT", reasonNote: catatan.trim() }
              : {}),
          };
        }),
        checkOutLatitude: location.latitude,
        checkOutLongitude: location.longitude,
        checkOutPhotoUrl: photoUrl,
      });
      if (result.locationWarning) toast.warning(result.locationWarning);
      toast.success("Check-Out berhasil. Sampai jumpa di shift berikutnya!");
      router.replace("/petugas/check-in");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Gagal Check-Out. Coba lagi.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading || !shift || !report) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (step === "LAPORAN") {
    return (
      <div className="min-h-screen bg-[#F7F9F6] max-w-md mx-auto pb-32">
        <TopBar title="Laporan Kembali" back="/petugas" />
        <div className="p-4">
          <div className="rounded-2xl bg-white border border-slate-200 p-4 mb-4">
            <p className="font-extrabold text-slate-900">{report.boothName}</p>
            <p className="text-xs text-slate-500">
              Shift {report.shiftTemplateName} • {formatTanggalJakarta(report.businessDate)}
            </p>
          </div>

          <p className="text-sm font-bold text-slate-800 mb-2">Rekap Stok Produk</p>
          <p className="text-xs text-slate-500 mb-2">
            Masukkan jumlah fisik cup yang tersisa di kolom Stok Fisik. Isi Catatan kalau ada selisih dari sistem.
          </p>
          <div className="rounded-2xl bg-white border border-slate-200 overflow-x-auto mb-4">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-slate-400 text-left whitespace-nowrap">
                  <th className="p-3 font-semibold">Produk</th>
                  <th className="p-3 font-semibold text-center">Awal</th>
                  <th className="p-3 font-semibold text-center">Restock</th>
                  <th className="p-3 font-semibold text-center">Terjual</th>
                  <th className="p-3 font-semibold text-center">Retur</th>
                  <th className="p-3 font-semibold text-center">Sisa Sistem</th>
                  <th className="p-3 font-semibold text-center">Stok Fisik</th>
                  <th className="p-3 font-semibold text-center">Selisih</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {baris.map((b) => {
                  const fisik = stokFisik[b.productId] ?? b.sisaSistem;
                  const selisih = fisik - b.sisaSistem;
                  return (
                    <tr key={b.productId}>
                      <td className="p-3 font-semibold text-slate-800 whitespace-nowrap">{b.productName}</td>
                      <td className="p-3 text-center">{b.stokAwal}</td>
                      <td className="p-3 text-center">{b.restock}</td>
                      <td className="p-3 text-center">{b.terjual}</td>
                      <td className="p-3 text-center">{b.retur}</td>
                      <td className="p-3 text-center font-bold">{b.sisaSistem}</td>
                      <td className="p-2 text-center">
                        <input
                          type="number"
                          min={0}
                          value={fisik === 0 ? "" : fisik}
                          placeholder="0"
                          onFocus={(e) => e.target.select()}
                          onChange={(e) =>
                            setStokFisik((prev) => ({
                              ...prev,
                              [b.productId]: e.target.value === "" ? 0 : Math.max(0, Number(e.target.value)),
                            }))
                          }
                          className={`w-16 rounded-lg border px-2 py-1.5 text-xs text-center ${
                            selisih !== 0 ? "border-amber-300 bg-amber-50" : "border-slate-200"
                          }`}
                        />
                      </td>
                      <td className={`p-3 text-center font-bold ${selisih === 0 ? "text-slate-400" : "text-rose-600"}`}>
                        {selisih === 0 ? "0" : selisih > 0 ? `+${selisih}` : selisih}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <p className="text-sm font-bold text-slate-800 mb-2">Rekap Penjualan</p>
          <div className="rounded-2xl bg-white border border-slate-200 overflow-x-auto mb-4">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-slate-400 text-left whitespace-nowrap">
                  <th className="p-3 font-semibold">No Transaksi</th>
                  <th className="p-3 font-semibold text-center">Jml Cup</th>
                  <th className="p-3 font-semibold text-center">Nominal</th>
                  <th className="p-3 font-semibold text-center">Tunai</th>
                  <th className="p-3 font-semibold text-center">QRIS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {report.transaksi.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-3 text-center text-slate-400">
                      Belum ada transaksi.
                    </td>
                  </tr>
                ) : (
                  report.transaksi.map((t) => (
                    <tr key={t.saleId}>
                      <td className="p-3 font-semibold text-slate-800 whitespace-nowrap">{t.saleNo}</td>
                      <td className="p-3 text-center">{t.cupCount}</td>
                      <td className="p-3 text-center font-bold">{formatRupiah(t.total)}</td>
                      <td className="p-3 text-center">{t.tunai > 0 ? formatRupiah(t.tunai) : "-"}</td>
                      <td className="p-3 text-center">{t.qris > 0 ? formatRupiah(t.qris) : "-"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <p className="text-sm font-bold text-slate-800 mb-2">Rekap Keuangan</p>
          <div className="grid grid-cols-3 gap-2 mb-4">
            <div className="rounded-xl bg-white border border-slate-200 p-3">
              <p className="text-[10px] text-slate-500">Total Penjualan</p>
              <p className="font-extrabold text-sm mt-1">{formatRupiah(report.totalPenjualan)}</p>
            </div>
            <div className="rounded-xl bg-white border border-slate-200 p-3">
              <p className="text-[10px] text-slate-500">Kas Tunai</p>
              <p className="font-extrabold text-sm mt-1">{formatRupiah(report.kasTunai)}</p>
            </div>
            <div className="rounded-xl bg-white border border-slate-200 p-3">
              <p className="text-[10px] text-slate-500">Kas QRIS</p>
              <p className="font-extrabold text-sm mt-1">{formatRupiah(report.kasQris)}</p>
            </div>
          </div>

          <textarea
            value={catatan}
            onChange={(e) => setCatatan(e.target.value)}
            placeholder="Contoh: kondisi stok, kendala, atau catatan lainnya..."
            rows={3}
            maxLength={500}
            className={`w-full rounded-xl border px-3 py-2.5 text-sm ${
              adaSelisih && !catatanTerisi ? "border-rose-300 bg-rose-50" : "border-slate-200"
            }`}
          />
          {adaSelisih && !catatanTerisi && (
            <p className="text-xs text-rose-600 mt-1.5">Ada selisih Stok Fisik — Catatan wajib diisi.</p>
          )}
        </div>

        <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-white border-t border-slate-200 p-4">
          <button
            type="button"
            onClick={lanjutCheckOut}
            className="w-full flex items-center justify-center rounded-xl py-3.5 font-extrabold text-white"
            style={{ backgroundColor: GREEN }}
          >
            LANJUT CHECK OUT
          </button>
        </div>
      </div>
    );
  }

  const durasiKerja = shift.openedAt ? formatDurasi(shift.openedAt, sekarang) : "-";

  return (
    <div className="min-h-screen bg-[#F7F9F6] max-w-md mx-auto pb-32">
      <TopBar title="Konfirmasi Check Out" back="/petugas/checkout" />
      <div className="p-4 space-y-4">
        <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-4 flex items-start gap-3">
          <CheckCircle2 size={22} className="text-emerald-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-sm text-emerald-800">Closing sudah lengkap</p>
            <p className="text-xs text-emerald-700 mt-0.5">
              Semua data laporan telah diisi dengan benar. Anda siap melakukan check out.
            </p>
          </div>
        </div>

        <div className="rounded-2xl bg-white border border-slate-200 p-4">
          <p className="text-sm font-bold text-slate-800 mb-3">Ringkasan Shift</p>
          <div className="space-y-2.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Booth</span>
              <span className="font-semibold text-slate-800">{shift.booth.name}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Shift</span>
              <span className="font-semibold text-slate-800">{shift.shiftName}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Tanggal</span>
              <span className="font-semibold text-slate-800">{formatTanggalJakarta(report.businessDate)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Jam Check-In</span>
              <span className="font-semibold text-slate-800">{shift.openedAt ? formatJamJakarta(shift.openedAt) : "-"}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Jam Sekarang</span>
              <span className="font-semibold text-slate-800">{formatJamJakarta(sekarang.toISOString())}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500 flex items-center gap-1">
                <Clock size={12} /> Durasi Kerja
              </span>
              <span className="font-semibold text-slate-800">{durasiKerja}</span>
            </div>
          </div>
        </div>

        <div>
          <p className="text-sm font-bold text-slate-800 mb-2">Konfirmasi Kehadiran</p>
          <AttendanceCapture location={location} onLocation={setLocation} photoFile={photoFile} onPhoto={(f) => setPhotoFile(f)} />
        </div>
      </div>
      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-white border-t border-slate-200 p-4 space-y-2.5">
        <button
          type="button"
          onClick={handleConfirmCheckout}
          disabled={!location || !photoFile || submitting}
          className="w-full flex items-center justify-center rounded-xl py-3.5 font-extrabold text-white disabled:opacity-50"
          style={{ backgroundColor: "#E57C23" }}
        >
          {submitting ? <Spinner size="sm" color="white" /> : "KONFIRMASI CHECK OUT"}
        </button>
        <button
          type="button"
          onClick={() => setStep("LAPORAN")}
          disabled={submitting}
          className="w-full text-center text-sm font-bold py-1"
          style={{ color: GREEN }}
        >
          Kembali ke Laporan
        </button>
      </div>
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <RequirePetugasAuth>
      <CheckoutContent />
    </RequirePetugasAuth>
  );
}
