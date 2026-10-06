"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, Clock, Printer, ReceiptText, type LucideIcon } from "lucide-react";
import { api, ApiError, type ActiveShift, type ShiftReport, type ClosingItem } from "@/lib/api-client";
import { useToast } from "@/components/ui/Toast";
import { Spinner } from "@/components/ui/Spinner";
import { RequirePetugasAuth } from "@/components/layout/RequirePetugasAuth";
import { useHidePetugasNav } from "@/components/layout/PetugasShell";
import { TopBar } from "../_components/TopBar";
import { QtyStepper } from "../_components/QtyStepper";
import { AttendanceCapture, type LocationValue } from "../_components/AttendanceCapture";
import { PanelLokasiDitolak, penolakanDariError, type PenolakanLokasi } from "../_components/LokasiDitolak";
import { formatRupiah, formatTanggalJakarta, formatJamJakarta, formatDurasi } from "../_lib/format";
import { isNativeBridgeAvailable, printBaris, stopGpsTracking } from "../_lib/native-bridge";
import { buatStrukRingkasanShift } from "../_lib/receipt";

import { OBBEL } from "../_lib/theme";
const GREEN = OBBEL.primaryDark;

function kelasAngka(n: number) {
  return n === 0 ? "text-slate-400 font-normal" : "text-slate-800 font-bold";
}

/// Cara bayar satu transaksi untuk daftar Rekap Penjualan; Split = Tunai + QRIS pada transaksi yang sama.
function labelBayar(t: { tunai: number; qris: number }): string {
  if (t.tunai > 0 && t.qris > 0) return "Split (Tunai + QRIS)";
  if (t.tunai > 0) return "Tunai";
  if (t.qris > 0) return "QRIS";
  return "-";
}

type Step = "LAPORAN" | "ABSEN";

/// Layar pengganti saat Check-Out belum bisa dilakukan (draft tertunda, belum jam selesai).
function LayarPenghalang({
  icon: Icon,
  judul,
  pesan,
  href,
  label,
  children,
}: {
  icon: LucideIcon;
  judul: string;
  pesan: string;
  href: string;
  label: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#F7F9F6] max-w-md mx-auto">
      <TopBar title="Setor & Pengembalian Stok" back="/petugas" />
      <div className="px-6 py-16 flex flex-col items-center text-center gap-3">
        <Icon size={40} style={{ color: OBBEL.accentOrange }} />
        <p className="font-extrabold text-lg text-slate-900">{judul}</p>
        <p className="text-base text-slate-500 max-w-72">{pesan}</p>
        {children}
        <Link
          href={href}
          className="mt-2 w-full max-w-72 flex items-center justify-center gap-2 rounded-full py-3.5 font-extrabold text-white"
          style={{ backgroundColor: OBBEL.primaryDark }}
        >
          <Icon size={18} />
          {label}
        </Link>
      </div>
    </div>
  );
}

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
  const [mencetak, setMencetak] = useState(false);
  const [sekarang, setSekarang] = useState(new Date());
  /// Nomor draft transaksi shift ini yang belum dibayar — Check-Out ditolak backend
  /// (PENDING_DRAFTS_EXIST) sampai semuanya dibayar atau dihapus di Kasir.
  const [draftTertunda, setDraftTertunda] = useState<string[] | null>(null);
  /// Pesan backend kalau Check-Out sebelum jam selesai shift (EARLY_CHECKOUT, BR-042).
  const [belumWaktunya, setBelumWaktunya] = useState<string | null>(null);
  /// Penolakan kalau lokasi Check-Out di luar radius Booth (OUTSIDE_ATTENDANCE_RADIUS).
  const [lokasiDitolak, setLokasiDitolak] = useState<PenolakanLokasi | null>(null);

  /// true kalau error-nya menghalangi Check-Out (layar beralih ke pemberitahuannya).
  function tanganiPenghalang(err: unknown): boolean {
    if (!(err instanceof ApiError)) return false;
    if (err.code === "PENDING_DRAFTS_EXIST") {
      setDraftTertunda((err.details?.saleNos as string[] | undefined) ?? []);
      return true;
    }
    if (err.code === "EARLY_CHECKOUT") {
      setBelumWaktunya(err.message);
      return true;
    }
    if (err.code === "ARRIVAL_REQUIRED") {
      toast.warning(err.message);
      router.replace("/petugas/tiba");
      return true;
    }
    return false;
  }

  /// Memuat laporan + snapshot penutupan. Dipanggil saat layar dibuka dan lagi
  /// kalau stok Booth berubah selagi layar ini terbuka (STOCK_CHANGED_DURING_CLOSING).
  async function muatData() {
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
      if (tanganiPenghalang(err)) return;
      toast.error(err instanceof ApiError ? err.message : "Gagal memuat laporan shift.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    muatData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  /// Struk ringkasan penjualan shift. Dibaca ulang dari server saat dicetak (bukan dari laporan di layar),
  /// jadi angkanya selalu yang terkini. Hanya bisa lewat printer Bluetooth di aplikasi Barista.
  async function cetakRingkasan() {
    if (!shift) return;
    if (!isNativeBridgeAvailable()) {
      toast.warning("Cetak ringkasan hanya bisa dari aplikasi Barista (printer Bluetooth).");
      return;
    }
    setMencetak(true);
    try {
      const r = await api.getShiftSalesSummary(shift.shiftSessionId);
      await printBaris(
        buatStrukRingkasanShift({
          shiftName: r.shiftTemplateName,
          barista: r.staffName,
          tanggalIso: r.businessDate,
          ...r,
        }),
      );
      toast.success("Ringkasan penjualan dicetak.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal mencetak ringkasan. Cek printer sudah dipilih & menyala.");
    } finally {
      setMencetak(false);
    }
  }

  function lanjutCheckOut() {
    if (!catatanTerisi) {
      toast.warning("Ada selisih Stok Fisik — isi alasannya dulu sebelum lanjut.");
      return;
    }
    setStep("ABSEN");
  }

  async function handleConfirmCheckout() {
    if (!shift || !location || !photoFile) return;
    setSubmitting(true);
    setLokasiDitolak(null);
    try {
      const { photoUrl } = await api.uploadAttendancePhoto(photoFile);
      await api.confirmClosing(shift.shiftSessionId, {
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
      stopGpsTracking();
      toast.success("Check-Out berhasil. Absen Kembali saat sampai di Gudang.");
      router.replace("/petugas");
    } catch (err) {
      if (tanganiPenghalang(err)) return;
      if (err instanceof ApiError && err.code === "OUTSIDE_ATTENDANCE_RADIUS") {
        setLokasiDitolak(penolakanDariError(err));
        return;
      }
      if (err instanceof ApiError && err.code === "STOCK_CHANGED_DURING_CLOSING") {
        // Stok berubah sejak layar dibuka — kembali ke laporan dengan angka terbaru.
        toast.warning(err.message);
        setStep("LAPORAN");
        await muatData();
        return;
      }
      toast.error(err instanceof ApiError ? err.message : "Gagal Check-Out. Coba lagi.");
    } finally {
      setSubmitting(false);
    }
  }

  if (draftTertunda) {
    return (
      <LayarPenghalang
        icon={ReceiptText}
        judul="Masih Ada Draft Transaksi"
        pesan="Bayar atau hapus draft berikut di Kasir sebelum Check-Out. Draft yang tertinggal tidak bisa diurus lagi setelah shift ditutup."
        href="/petugas/kasir"
        label="Buka Kasir"
      >
        {draftTertunda.length > 0 && <p className="font-bold text-slate-800">{draftTertunda.join(", ")}</p>}
      </LayarPenghalang>
    );
  }

  if (belumWaktunya) {
    return <LayarPenghalang icon={Clock} judul="Belum Waktunya Check-Out" pesan={belumWaktunya} href="/petugas" label="Kembali ke Beranda" />;
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
        <TopBar title="Setor & Pengembalian Stok" back="/petugas" />
        <div className="p-4">
          <div className="rounded-2xl bg-white border border-slate-200 p-4 mb-4">
            <p className="font-extrabold text-slate-900">{report.boothName}</p>
            <p className="text-sm text-slate-500">
              Shift {report.shiftTemplateName} • {formatTanggalJakarta(report.businessDate)}
            </p>
          </div>

          <p className="text-base font-bold text-slate-800 mb-2">Rekap Stok Produk</p>
          <p className="text-sm text-slate-500 mb-2">
            Masukkan jumlah fisik cup yang tersisa di kolom Stok Fisik. Kalau ada selisih dari sistem, isi alasannya di bawah.
          </p>
          <div className="space-y-2 mb-4">
            {baris.map((b) => {
              const fisik = stokFisik[b.productId] ?? b.sisaSistem;
              const selisih = fisik - b.sisaSistem;
              const angka: [string, number][] = [
                ["Awal", b.stokAwal],
                ["Restock", b.restock],
                ["Terjual", b.terjual],
                ["Retur", b.retur],
                ["Sisa Sistem", b.sisaSistem],
              ];
              return (
                <div
                  key={b.productId}
                  className={`rounded-2xl bg-white border p-3 ${selisih !== 0 ? "border-amber-300" : "border-slate-200"}`}
                >
                  <p className="font-bold text-slate-900 wrap-break-word">{b.productName}</p>
                  <div className="grid grid-cols-5 gap-1 mt-2 text-center">
                    {angka.map(([label, nilai]) => (
                      <div key={label}>
                        <p className="text-[11px] leading-tight text-slate-400">{label}</p>
                        <p className={`text-base ${kelasAngka(nilai)}`}>{nilai}</p>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center justify-between gap-3 mt-3 pt-3 border-t border-slate-100">
                    <div>
                      <p className="text-sm font-semibold text-slate-600">Stok Fisik</p>
                      <p className={`text-sm font-bold ${selisih === 0 ? "text-slate-400" : "text-rose-600"}`}>
                        Selisih {selisih === 0 ? "0" : selisih > 0 ? `+${selisih}` : selisih}
                      </p>
                    </div>
                    <QtyStepper
                      value={fisik}
                      highlighted={selisih !== 0}
                      onChange={(n) => setStokFisik((prev) => ({ ...prev, [b.productId]: n }))}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <p className="text-base font-bold text-slate-800 mb-2">Rekap Penjualan</p>
          <div className="rounded-2xl bg-white border border-slate-200 divide-y divide-slate-100 mb-4">
            {report.transaksi.length === 0 ? (
              <p className="p-3 text-center text-sm text-slate-400">Belum ada transaksi.</p>
            ) : (
              report.transaksi.map((t) => (
                <div key={t.saleId} className="flex items-center justify-between gap-3 p-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-800">{t.saleNo}</p>
                    <p className="text-sm text-slate-500">
                      {t.cupCount} cup • {labelBayar(t)}
                    </p>
                  </div>
                  <p className="shrink-0 font-bold text-slate-900">{formatRupiah(t.total)}</p>
                </div>
              ))
            )}
          </div>

          <p className="text-base font-bold text-slate-800 mb-2">Rekap Keuangan</p>
          <div className="grid grid-cols-3 gap-2 mb-4">
            <div className="rounded-xl bg-white border border-slate-200 p-3">
              <p className="text-xs text-slate-500">Total Penjualan</p>
              <p className="font-extrabold text-base mt-1">{formatRupiah(report.totalPenjualan)}</p>
            </div>
            <div className="rounded-xl bg-white border border-slate-200 p-3">
              <p className="text-xs text-slate-500">Kas Tunai</p>
              <p className="font-extrabold text-base mt-1">{formatRupiah(report.kasTunai)}</p>
            </div>
            <div className="rounded-xl bg-white border border-slate-200 p-3">
              <p className="text-xs text-slate-500">Kas QRIS</p>
              <p className="font-extrabold text-base mt-1">{formatRupiah(report.kasQris)}</p>
            </div>
          </div>
          {report.uangJalan > 0 && (
            <div className="rounded-xl bg-white border border-slate-200 p-3 mb-4 text-sm flex flex-col gap-1">
              <p className="font-bold text-slate-700">Uang disetor saat Kembali di Gudang</p>
              <div className="flex justify-between text-slate-500">
                <span>Kas Tunai + Uang jalan</span>
                <span>
                  {formatRupiah(report.kasTunai)} + {formatRupiah(report.uangJalan)}
                </span>
              </div>
              <div className="flex justify-between font-extrabold text-slate-900">
                <span>Total</span>
                <span>{formatRupiah(report.kasTunai + report.uangJalan)}</span>
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={cetakRingkasan}
            disabled={mencetak}
            className="w-full mb-4 flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white py-3 font-bold text-slate-700 disabled:opacity-50"
          >
            {mencetak ? <Spinner size="sm" /> : <Printer size={18} />}
            Cetak Ringkasan Penjualan
          </button>

          {adaSelisih && (
            <div>
              <p className="text-base font-bold text-slate-800 mb-2">Alasan Selisih Stok</p>
              <textarea
                value={catatan}
                onChange={(e) => setCatatan(e.target.value)}
                placeholder="Contoh: 1 cup tumpah, salah hitung saat restock..."
                rows={3}
                maxLength={500}
                className={`w-full rounded-xl border px-3 py-3 text-base ${catatanTerisi ? "border-slate-200" : "border-rose-300 bg-rose-50"}`}
              />
              {!catatanTerisi && <p className="text-sm text-rose-600 mt-1.5">Ada selisih Stok Fisik — alasan wajib diisi.</p>}
            </div>
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
      <TopBar title="Konfirmasi Check Out" onBack={() => setStep("LAPORAN")} />
      <div className="p-4 space-y-4">
        <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-4 flex items-start gap-3">
          <CheckCircle2 size={22} className="text-emerald-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-base text-emerald-800">Closing sudah lengkap</p>
            <p className="text-sm text-emerald-700 mt-0.5">
              Semua data laporan telah diisi dengan benar. Anda siap melakukan check out.
            </p>
          </div>
        </div>

        <div className="rounded-2xl bg-white border border-slate-200 p-4">
          <p className="text-base font-bold text-slate-800 mb-3">Ringkasan Shift</p>
          <div className="space-y-2.5 text-sm">
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
              <span className="text-slate-500">Jam Berangkat</span>
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
          <p className="text-base font-bold text-slate-800 mb-2">Konfirmasi Kehadiran</p>
          {lokasiDitolak && (
            <div className="mb-3">
              <PanelLokasiDitolak penolakan={lokasiDitolak} tempat="booth" />
            </div>
          )}
          <AttendanceCapture
            location={location}
            onLocation={(loc) => {
              setLocation(loc);
              setLokasiDitolak(null);
            }}
            photoFile={photoFile}
            onPhoto={(f) => setPhotoFile(f)}
          />
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
          className="w-full text-center text-base font-bold py-1"
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
