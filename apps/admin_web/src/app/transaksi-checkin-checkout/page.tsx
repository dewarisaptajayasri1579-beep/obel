"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Clock,
  Coffee,
  Fingerprint,
  MapPin,
  Search,
  Timer,
  X,
  XCircle,
} from "lucide-react";
import { RequireAuth } from "@/components/layout/RequireAuth";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { Spinner } from "@/components/ui/Spinner";
import { useToast } from "@/components/ui/Toast";
import { api, ApiError, type Booth, type ShiftAdminHistoryItem, type UserAccount } from "@/lib/api-client";
import { TRANSAKSI_BOOTH_FILTER_KEYS, usePersistedFilter } from "@/lib/use-persisted-filter";

// Leaflet menyentuh `window`/`document` langsung — wajib no-SSR.
const AbsenMiniMap = dynamic(() => import("./AbsenMiniMap").then((m) => m.AbsenMiniMap), {
  ssr: false,
  loading: () => (
    <div className="h-36 rounded-xl border border-slate-200 dark:border-line flex items-center justify-center">
      <Spinner />
    </div>
  ),
});

type Tab = "SEMUA" | "AKTIF" | "SELESAI";
type Periode = "SEMUA" | "HARI_INI" | "MINGGU_INI" | "BULAN_INI" | "CUSTOM";

const JAKARTA_OFFSET_MS = 7 * 60 * 60 * 1000;

const PERIODE_OPTIONS: { value: Periode; label: string }[] = [
  { value: "SEMUA", label: "Semua Periode" },
  { value: "HARI_INI", label: "Hari Ini" },
  { value: "MINGGU_INI", label: "Minggu Ini" },
  { value: "BULAN_INI", label: "Bulan Ini" },
  { value: "CUSTOM", label: "Custom" },
];

/// Batas [awal, akhir) periode di zona Asia/Jakarta (offset tetap +7, tidak
/// ada DST), dibandingkan langsung terhadap `businessDate` yang juga
/// disimpan sebagai tengah malam Jakarta (lihat startOfTodayJakarta di
/// backend) — sama pola dgn Periode di Transaksi Kasir, ditambah CUSTOM.
function rentangPeriode(
  periode: Periode,
  customDari: string,
  customSampai: string,
  now: Date,
): { awal: Date | null; akhir: Date | null } {
  const j = new Date(now.getTime() + JAKARTA_OFFSET_MS);
  if (periode === "HARI_INI") {
    return { awal: new Date(Date.UTC(j.getUTCFullYear(), j.getUTCMonth(), j.getUTCDate()) - JAKARTA_OFFSET_MS), akhir: null };
  }
  if (periode === "MINGGU_INI") {
    const dow = j.getUTCDay(); // 0=Min..6=Sab
    const senin = dow === 0 ? -6 : 1 - dow;
    return { awal: new Date(Date.UTC(j.getUTCFullYear(), j.getUTCMonth(), j.getUTCDate() + senin) - JAKARTA_OFFSET_MS), akhir: null };
  }
  if (periode === "BULAN_INI") {
    return { awal: new Date(Date.UTC(j.getUTCFullYear(), j.getUTCMonth(), 1) - JAKARTA_OFFSET_MS), akhir: null };
  }
  if (periode === "CUSTOM") {
    const awal = customDari ? new Date(`${customDari}T00:00:00+07:00`) : null;
    const sampai = customSampai ? new Date(`${customSampai}T00:00:00+07:00`) : null;
    return { awal, akhir: sampai ? new Date(sampai.getTime() + 24 * 60 * 60 * 1000) : null };
  }
  return { awal: null, akhir: null };
}

const STATUS_LABEL: Record<ShiftAdminHistoryItem["status"], { label: string; kelas: string }> = {
  SCHEDULED: { label: "Terjadwal", kelas: "bg-slate-100 dark:bg-surface-hover text-slate-500 dark:text-fg-muted border-slate-200 dark:border-line" },
  OPEN: { label: "Sedang Aktif", kelas: "bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-900/40" },
  CLOSING: { label: "Proses Tutup", kelas: "bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-900/40" },
  CLOSED: { label: "Selesai", kelas: "bg-brand-50 dark:bg-brand-500/10 text-[var(--brand-700)] dark:text-brand-400 border-brand-200 dark:border-brand-500/20" },
  CANCELLED: { label: "Dibatalkan", kelas: "bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-900/40" },
};

function jamJakarta(iso: string | null) {
  if (!iso) return "-";
  return new Intl.DateTimeFormat("id-ID", { timeStyle: "short", timeZone: "Asia/Jakarta" }).format(new Date(iso));
}

function waktuLengkapJakarta(iso: string | null) {
  if (!iso) return "-";
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "long", timeStyle: "medium", timeZone: "Asia/Jakarta" }).format(new Date(iso));
}

function durasi(openedAt: string | null, closedAt: string | null) {
  if (!openedAt || !closedAt) return "-";
  const menit = Math.round((new Date(closedAt).getTime() - new Date(openedAt).getTime()) / 60000);
  if (menit < 0) return "-";
  const jam = Math.floor(menit / 60);
  const sisaMenit = menit % 60;
  return jam > 0 ? `${jam}j ${sisaMenit}m` : `${sisaMenit}m`;
}

interface PreviewFoto {
  url: string;
  label: string;
  waktu: string | null;
  latitude: number | null;
  longitude: number | null;
}

function FotoAbsen({ url, label, onOpen }: { url: string | null; label: string; onOpen: () => void }) {
  if (!url) return <span className="text-slate-400 dark:text-fg-muted">-</span>;
  return (
    <button type="button" onClick={onOpen} className="inline-flex items-center gap-2 group cursor-pointer">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt={label}
        className="w-8 h-8 rounded-lg object-cover border border-slate-200 dark:border-line group-hover:ring-2 group-hover:ring-[var(--brand-700)]/30 transition-all"
      />
    </button>
  );
}

function TransaksiCheckinCheckoutContent() {
  const toast = useToast();
  const [rows, setRows] = useState<ShiftAdminHistoryItem[] | null>(null);
  const [booths, setBooths] = useState<Booth[]>([]);
  const [staffList, setStaffList] = useState<UserAccount[]>([]);
  const [tabRaw, setTabRaw] = usePersistedFilter("transaksi-checkin-checkout:tab", "SEMUA");
  const tab = tabRaw as Tab;
  const setTab = (v: Tab) => setTabRaw(v);
  const [boothId, setBoothId] = usePersistedFilter(TRANSAKSI_BOOTH_FILTER_KEYS.boothId, "");
  const [staffId, setStaffId] = usePersistedFilter(TRANSAKSI_BOOTH_FILTER_KEYS.staffId, "");
  const [search, setSearch] = usePersistedFilter("transaksi-checkin-checkout:search", "");
  const [periodeFilterRaw, setPeriodeFilterRaw] = usePersistedFilter("transaksi-checkin-checkout:periode", "SEMUA");
  const periodeFilter = periodeFilterRaw as Periode;
  const setPeriodeFilter = (v: Periode) => setPeriodeFilterRaw(v);
  const [customDari, setCustomDari] = usePersistedFilter("transaksi-checkin-checkout:custom-dari", "");
  const [customSampai, setCustomSampai] = usePersistedFilter("transaksi-checkin-checkout:custom-sampai", "");
  const [previewFoto, setPreviewFoto] = useState<PreviewFoto | null>(null);

  useEffect(() => {
    api.getBooths().then(setBooths).catch(() => {});
    api
      .getUsers()
      .then((users) => setStaffList(users.filter((u) => u.role === "BOOTH_STAFF")))
      .catch(() => {});
    api
      .getShiftAdminHistory()
      .then(setRows)
      .catch((err) => {
        toast.error(err instanceof ApiError ? err.message : "Gagal memuat riwayat Check In-Check Out.");
        setRows([]);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    if (!rows) return [];
    const q = search.trim().toLowerCase();
    const { awal, akhir } = rentangPeriode(periodeFilter, customDari, customSampai, new Date());
    return rows.filter((r) => {
      if (tab === "AKTIF" && r.status !== "OPEN" && r.status !== "CLOSING") return false;
      if (tab === "SELESAI" && r.status !== "CLOSED") return false;
      if (boothId && r.boothId !== boothId) return false;
      if (staffId && r.staffId !== staffId) return false;
      if (q && !r.boothName.toLowerCase().includes(q) && !r.staffName.toLowerCase().includes(q)) return false;
      const businessDate = new Date(r.businessDate);
      if (awal && businessDate < awal) return false;
      if (akhir && businessDate >= akhir) return false;
      return true;
    });
  }, [rows, tab, boothId, staffId, search, periodeFilter, customDari, customSampai]);

  const filterAktif = search.trim() !== "" || boothId !== "" || staffId !== "" || tab !== "SEMUA" || periodeFilter !== "SEMUA";

  function resetFilter() {
    setSearch("");
    setBoothId("");
    setStaffId("");
    setTab("SEMUA");
    setPeriodeFilter("SEMUA");
    setCustomDari("");
    setCustomSampai("");
  }

  const jumlahAktif = rows?.filter((r) => r.status === "OPEN" || r.status === "CLOSING").length ?? 0;
  const jumlahSelesai = rows?.filter((r) => r.status === "CLOSED").length ?? 0;
  const totalCup = rows?.reduce((sum, r) => sum + r.totalJualCup, 0) ?? 0;

  return (
    <div className="space-y-5">
      <Breadcrumb items={[{ label: "Dashboard", href: "/dashboard" }, { label: "Transaksi Booth" }, { label: "Check In-Check Out" }]} />

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-brand-50 dark:bg-brand-500/10 text-[var(--brand-700)] dark:text-brand-400 flex items-center justify-center flex-shrink-0 border border-brand-100 dark:border-brand-500/20 shadow-2xs">
            <Fingerprint className="w-4.5 h-4.5" />
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-fg tracking-tight leading-tight">
              Transaksi Booth - Check In-Check Out
            </h1>
            <p className="text-xs text-slate-500 dark:text-fg-muted font-normal mt-0.5">
              Riwayat absen Petugas Booth (foto selfie & waktu). Read-only — absen dilakukan Petugas Booth di app.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="rounded-xl border border-slate-200/80 dark:border-line bg-white/80 dark:bg-surface p-3.5 shadow-2xs flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-brand-50 dark:bg-brand-500/10 text-[var(--brand-700)] dark:text-brand-400 flex items-center justify-center flex-shrink-0 border border-brand-100 dark:border-brand-500/20">
            <Fingerprint className="w-4.5 h-4.5" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 dark:text-fg-muted">Total Sesi</p>
            <p className="text-lg sm:text-xl font-bold text-slate-900 dark:text-fg tracking-tight leading-tight mt-0.5">{rows?.length ?? 0}</p>
            <p className="text-[11px] text-slate-400 dark:text-fg-muted mt-0.5">seluruh Booth</p>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200/80 dark:border-line bg-white/80 dark:bg-surface p-3.5 shadow-2xs flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 flex items-center justify-center flex-shrink-0 border border-amber-100 dark:border-amber-900/30">
            <Clock className="w-4.5 h-4.5" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 dark:text-fg-muted">Sedang Aktif</p>
            <p className="text-lg sm:text-xl font-bold text-slate-900 dark:text-fg tracking-tight leading-tight mt-0.5">{jumlahAktif}</p>
            <p className="text-[11px] text-slate-400 dark:text-fg-muted mt-0.5">belum check-out</p>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200/80 dark:border-line bg-white/80 dark:bg-surface p-3.5 shadow-2xs flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center flex-shrink-0 border border-emerald-100 dark:border-emerald-900/30">
            <CheckCircle2 className="w-4.5 h-4.5" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 dark:text-fg-muted">Selesai</p>
            <p className="text-lg sm:text-xl font-bold text-slate-900 dark:text-fg tracking-tight leading-tight mt-0.5">{jumlahSelesai}</p>
            <p className="text-[11px] text-slate-400 dark:text-fg-muted mt-0.5">sudah check-out</p>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200/80 dark:border-line bg-white/80 dark:bg-surface p-3.5 shadow-2xs flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-sky-50 dark:bg-sky-900/20 text-sky-600 dark:text-sky-400 flex items-center justify-center flex-shrink-0 border border-sky-100 dark:border-sky-900/30">
            <Coffee className="w-4.5 h-4.5" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 dark:text-fg-muted">Total Jual Cup</p>
            <p className="text-lg sm:text-xl font-bold text-slate-900 dark:text-fg tracking-tight leading-tight mt-0.5">{totalCup}</p>
            <p className="text-[11px] text-slate-400 dark:text-fg-muted mt-0.5">seluruh sesi</p>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200/80 dark:border-line bg-white dark:bg-surface shadow-2xs p-4">
        <div className="flex items-center gap-2.5 flex-wrap mb-3.5">
          <div className="relative flex items-center flex-1 min-w-[200px] sm:max-w-[280px]">
            <Search className="w-3.5 h-3.5 text-slate-400 dark:text-fg-muted absolute left-3.5 pointer-events-none" />
            <input
              type="text"
              placeholder="Cari booth atau petugas..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={`w-full h-9 pl-9 pr-8 text-xs sm:text-sm font-medium rounded-xl bg-white/90 dark:bg-surface border text-slate-800 dark:text-fg placeholder:text-slate-400 dark:placeholder:text-fg-muted focus:outline-none focus:border-[var(--brand-700)] focus:ring-2 focus:ring-[var(--brand-700)]/10 transition-colors shadow-2xs ${
                search.trim() !== "" ? "border-amber-400 dark:border-amber-500/50" : "border-slate-200/90 dark:border-line"
              }`}
            />
            {search.trim() !== "" && (
              <button
                type="button"
                onClick={() => setSearch("")}
                title="Bersihkan pencarian"
                className="absolute right-2.5 p-0.5 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-fg cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="w-44">
            <Select
              options={booths.map((b) => ({ value: b.id, label: b.name }))}
              value={boothId}
              onChange={setBoothId}
              placeholder="Semua Booth"
              sizeVariant="sm"
              className="!h-9"
              active={boothId !== ""}
            />
          </div>

          <div className="w-44">
            <Select
              options={staffList.map((s) => ({ value: s.id, label: s.fullName }))}
              value={staffId}
              onChange={setStaffId}
              placeholder="Semua Petugas"
              sizeVariant="sm"
              className="!h-9"
              active={staffId !== ""}
            />
          </div>

          <div className="w-44">
            <Select
              options={PERIODE_OPTIONS}
              value={periodeFilter}
              onChange={(v) => setPeriodeFilter(v as Periode)}
              placeholder="Semua Periode"
              sizeVariant="sm"
              className="!h-9"
              active={periodeFilter !== "SEMUA"}
            />
          </div>

          {periodeFilter === "CUSTOM" && (
            <div className="flex items-center gap-1.5">
              <input
                type="date"
                value={customDari}
                onChange={(e) => setCustomDari(e.target.value)}
                max={customSampai || undefined}
                className="h-9 px-2.5 text-xs font-medium rounded-xl bg-white/90 dark:bg-surface border border-slate-200/90 dark:border-line text-slate-800 dark:text-fg focus:outline-none focus:border-[var(--brand-700)] focus:ring-2 focus:ring-[var(--brand-700)]/10 transition-colors shadow-2xs"
              />
              <span className="text-xs text-slate-400 dark:text-fg-muted">s/d</span>
              <input
                type="date"
                value={customSampai}
                onChange={(e) => setCustomSampai(e.target.value)}
                min={customDari || undefined}
                className="h-9 px-2.5 text-xs font-medium rounded-xl bg-white/90 dark:bg-surface border border-slate-200/90 dark:border-line text-slate-800 dark:text-fg focus:outline-none focus:border-[var(--brand-700)] focus:ring-2 focus:ring-[var(--brand-700)]/10 transition-colors shadow-2xs"
              />
            </div>
          )}

          <div className="flex gap-2">
            {([
              ["SEMUA", "Semua"],
              ["AKTIF", "Aktif"],
              ["SELESAI", "Selesai"],
            ] as [Tab, string][]).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setTab(key)}
                className={`h-9 px-3 rounded-xl text-xs font-bold cursor-pointer transition-colors ${
                  tab === key
                    ? "bg-[var(--brand-700)] text-white"
                    : "bg-white/90 dark:bg-surface border border-slate-200/90 dark:border-line text-slate-600 dark:text-fg-secondary hover:bg-slate-50 dark:hover:bg-surface-hover"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {filterAktif && (
            <button
              type="button"
              onClick={resetFilter}
              title="Hapus semua filter yang aktif"
              className="flex items-center gap-1.5 px-3 h-9 rounded-xl bg-amber-50 dark:bg-amber-900/15 hover:bg-amber-100 dark:hover:bg-amber-900/25 border border-amber-200 dark:border-amber-900/40 text-xs font-semibold text-amber-700 dark:text-amber-400 cursor-pointer transition-colors"
            >
              <XCircle className="w-3.5 h-3.5" />
              <span>Reset Filter</span>
            </button>
          )}
        </div>

        {!rows ? (
          <div className="flex justify-center py-14">
            <Spinner />
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200/70 dark:border-line">
            <table className="w-full text-xs text-left">
              <thead className="bg-brand-50/70 dark:bg-surface-hover/80 text-[11px] font-bold text-slate-700 dark:text-fg-secondary border-b border-slate-200/80 dark:border-line">
                <tr>
                  <th className="py-3.5 px-3">No</th>
                  <th className="py-3.5 px-3">Tanggal</th>
                  <th className="py-3.5 px-3">Booth</th>
                  <th className="py-3.5 px-3">Petugas</th>
                  <th className="py-3.5 px-3">Check In</th>
                  <th className="py-3.5 px-3">Check Out</th>
                  <th className="py-3.5 px-3">Durasi</th>
                  <th className="py-3.5 px-3 text-right">Total Jual Cup</th>
                  <th className="py-3.5 px-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-line bg-white dark:bg-surface">
                {filtered.map((r, index) => {
                  const status = STATUS_LABEL[r.status];
                  return (
                    <tr key={r.id} className="hover:bg-brand-50/20 dark:hover:bg-surface-hover/40 transition-colors">
                      <td className="py-3 px-3 text-slate-500 dark:text-fg-muted tabular-nums">{index + 1}</td>
                      <td className="py-3 px-3 text-slate-600 dark:text-fg-secondary whitespace-nowrap">
                        {new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeZone: "Asia/Jakarta" }).format(new Date(r.businessDate))}
                      </td>
                      <td className="py-3 px-3 font-semibold text-slate-800 dark:text-fg">{r.boothName}</td>
                      <td className="py-3 px-3 text-slate-700 dark:text-fg-secondary">{r.staffName}</td>
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2">
                          <FotoAbsen
                            url={r.checkInPhotoUrl}
                            label="Foto Check In"
                            onOpen={() =>
                              setPreviewFoto({
                                url: r.checkInPhotoUrl!,
                                label: `Check In — ${r.staffName}`,
                                waktu: r.openedAt,
                                latitude: r.checkInLatitude,
                                longitude: r.checkInLongitude,
                              })
                            }
                          />
                          <span className="text-slate-600 dark:text-fg-secondary whitespace-nowrap">{jamJakarta(r.openedAt)}</span>
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2">
                          <FotoAbsen
                            url={r.checkOutPhotoUrl}
                            label="Foto Check Out"
                            onOpen={() =>
                              setPreviewFoto({
                                url: r.checkOutPhotoUrl!,
                                label: `Check Out — ${r.staffName}`,
                                waktu: r.closedAt,
                                latitude: r.checkOutLatitude,
                                longitude: r.checkOutLongitude,
                              })
                            }
                          />
                          <span className="text-slate-600 dark:text-fg-secondary whitespace-nowrap">{jamJakarta(r.closedAt)}</span>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-slate-600 dark:text-fg-secondary whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <Timer className="w-3.5 h-3.5 text-slate-400 dark:text-fg-muted" />
                          {durasi(r.openedAt, r.closedAt)}
                        </div>
                      </td>
                      <td className="py-3 px-3 text-right tabular-nums font-semibold text-slate-800 dark:text-fg">{r.totalJualCup} cup</td>
                      <td className="py-3 px-3 text-center">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${status.kelas}`}>
                          {status.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}

                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={9} className="text-center text-slate-500 dark:text-fg-muted py-10 text-xs">
                      Tidak ada riwayat Check In-Check Out yang cocok.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal isOpen={previewFoto !== null} onClose={() => setPreviewFoto(null)} title={previewFoto?.label} size="sm">
        {previewFoto && (
          <div className="space-y-3.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewFoto.url}
              alt={previewFoto.label}
              className="w-full max-h-80 object-contain rounded-xl border border-slate-200 dark:border-line bg-slate-50 dark:bg-surface-hover"
            />
            <p className="text-xs text-slate-500 dark:text-fg-muted flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 shrink-0" />
              {waktuLengkapJakarta(previewFoto.waktu)} WIB
            </p>
            {previewFoto.latitude !== null && previewFoto.longitude !== null ? (
              <AbsenMiniMap latitude={previewFoto.latitude} longitude={previewFoto.longitude} />
            ) : (
              <p className="text-xs text-slate-400 dark:text-fg-muted flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 shrink-0" />
                Lokasi tidak tercatat.
              </p>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}

export default function TransaksiCheckinCheckoutPage() {
  return (
    <RequireAuth>
      <TransaksiCheckinCheckoutContent />
    </RequireAuth>
  );
}
