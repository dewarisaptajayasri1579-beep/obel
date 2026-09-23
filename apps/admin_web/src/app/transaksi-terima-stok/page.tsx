"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  Clock,
  PackageCheck,
  Search,
  Warehouse,
  X,
  XCircle,
} from "lucide-react";
import { RequireAuth } from "@/components/layout/RequireAuth";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { Select } from "@/components/ui/Select";
import { Spinner } from "@/components/ui/Spinner";
import { useToast } from "@/components/ui/Toast";
import { api, ApiError, type Booth, type Distribution, type UserAccount } from "@/lib/api-client";
import { TRANSAKSI_BOOTH_FILTER_KEYS, usePersistedFilter } from "@/lib/use-persisted-filter";

type Tab = "SEMUA" | "MENUNGGU" | "SELESAI";

const STATUS_LABEL: Record<Distribution["status"], { label: string; kelas: string }> = {
  DRAFT: { label: "Draft", kelas: "bg-slate-100 dark:bg-surface-hover text-slate-500 dark:text-fg-muted border-slate-200 dark:border-line" },
  SENT: { label: "Menunggu Diterima", kelas: "bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-900/40" },
  RECEIVED: { label: "Selesai", kelas: "bg-brand-50 dark:bg-brand-500/10 text-[var(--brand-700)] dark:text-brand-400 border-brand-200 dark:border-brand-500/20" },
  DISCREPANCY: { label: "Selesai · Selisih", kelas: "bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-900/40" },
  CANCELLED: { label: "Dibatalkan", kelas: "bg-slate-100 dark:bg-surface-hover text-slate-500 dark:text-fg-muted border-slate-200 dark:border-line" },
};

function waktuJakarta(iso: string | null) {
  if (!iso) return "-";
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" }).format(new Date(iso));
}

function TransaksiTerimaStokContent() {
  const toast = useToast();
  const [rows, setRows] = useState<Distribution[] | null>(null);
  const [booths, setBooths] = useState<Booth[]>([]);
  const [staffList, setStaffList] = useState<UserAccount[]>([]);
  const [tabRaw, setTabRaw] = usePersistedFilter("transaksi-terima-stok:tab", "SEMUA");
  const tab = tabRaw as Tab;
  const setTab = (v: Tab) => setTabRaw(v);
  const [boothId, setBoothId] = usePersistedFilter(TRANSAKSI_BOOTH_FILTER_KEYS.boothId, "");
  const [staffId, setStaffId] = usePersistedFilter(TRANSAKSI_BOOTH_FILTER_KEYS.staffId, "");
  const [search, setSearch] = usePersistedFilter("transaksi-terima-stok:search", "");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    api.getBooths().then(setBooths).catch(() => {});
    api
      .getUsers()
      .then((users) => setStaffList(users.filter((u) => u.role === "BOOTH_STAFF")))
      .catch(() => {});
    api
      .getDistributions()
      .then(setRows)
      .catch((err) => {
        toast.error(err instanceof ApiError ? err.message : "Gagal memuat daftar Terima Stok.");
        setRows([]);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    if (!rows) return [];
    const q = search.trim().toLowerCase();
    return rows.filter((d) => {
      if (tab === "MENUNGGU" && d.status !== "SENT") return false;
      if (tab === "SELESAI" && d.status !== "RECEIVED" && d.status !== "DISCREPANCY") return false;
      if (boothId && d.boothId !== boothId) return false;
      if (staffId && d.receivedById !== staffId) return false;
      if (q && !d.distributionNo.toLowerCase().includes(q) && !d.boothName.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [rows, tab, boothId, staffId, search]);

  const filterAktif = search.trim() !== "" || boothId !== "" || staffId !== "" || tab !== "SEMUA";

  function resetFilter() {
    setSearch("");
    setBoothId("");
    setStaffId("");
    setTab("SEMUA");
  }

  const jumlahMenunggu = rows?.filter((d) => d.status === "SENT").length ?? 0;
  const jumlahSelesai = rows?.filter((d) => d.status === "RECEIVED" || d.status === "DISCREPANCY").length ?? 0;
  const jumlahSelisih = rows?.filter((d) => d.status === "DISCREPANCY").length ?? 0;

  return (
    <div className="space-y-5">
      <Breadcrumb items={[{ label: "Dashboard", href: "/dashboard" }, { label: "Transaksi Booth" }, { label: "Terima Stok" }]} />

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-brand-50 dark:bg-brand-500/10 text-[var(--brand-700)] dark:text-brand-400 flex items-center justify-center flex-shrink-0 border border-brand-100 dark:border-brand-500/20 shadow-2xs">
            <PackageCheck className="w-4.5 h-4.5" />
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-fg tracking-tight leading-tight">
              Transaksi Booth - Terima Stok
            </h1>
            <p className="text-xs text-slate-500 dark:text-fg-muted font-normal mt-0.5">
              Penerimaan stok gudang → booth dari semua Booth. Read-only — konfirmasi penerimaan dilakukan Petugas Booth.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="rounded-xl border border-slate-200/80 dark:border-line bg-white/80 dark:bg-surface p-3.5 shadow-2xs flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-brand-50 dark:bg-brand-500/10 text-[var(--brand-700)] dark:text-brand-400 flex items-center justify-center flex-shrink-0 border border-brand-100 dark:border-brand-500/20">
            <Warehouse className="w-4.5 h-4.5" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 dark:text-fg-muted">Total Dokumen</p>
            <p className="text-lg sm:text-xl font-bold text-slate-900 dark:text-fg tracking-tight leading-tight mt-0.5">{rows?.length ?? 0}</p>
            <p className="text-[11px] text-slate-400 dark:text-fg-muted mt-0.5">seluruh Booth</p>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200/80 dark:border-line bg-white/80 dark:bg-surface p-3.5 shadow-2xs flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 flex items-center justify-center flex-shrink-0 border border-amber-100 dark:border-amber-900/30">
            <Clock className="w-4.5 h-4.5" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 dark:text-fg-muted">Menunggu Diterima</p>
            <p className="text-lg sm:text-xl font-bold text-slate-900 dark:text-fg tracking-tight leading-tight mt-0.5">{jumlahMenunggu}</p>
            <p className="text-[11px] text-slate-400 dark:text-fg-muted mt-0.5">status SENT</p>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200/80 dark:border-line bg-white/80 dark:bg-surface p-3.5 shadow-2xs flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center flex-shrink-0 border border-emerald-100 dark:border-emerald-900/30">
            <CheckCircle2 className="w-4.5 h-4.5" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 dark:text-fg-muted">Selesai</p>
            <p className="text-lg sm:text-xl font-bold text-slate-900 dark:text-fg tracking-tight leading-tight mt-0.5">{jumlahSelesai}</p>
            <p className="text-[11px] text-slate-400 dark:text-fg-muted mt-0.5">sudah dikonfirmasi</p>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200/80 dark:border-line bg-white/80 dark:bg-surface p-3.5 shadow-2xs flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 flex items-center justify-center flex-shrink-0 border border-rose-100 dark:border-rose-900/30">
            <AlertTriangle className="w-4.5 h-4.5" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 dark:text-fg-muted">Ada Selisih</p>
            <p className="text-lg sm:text-xl font-bold text-slate-900 dark:text-fg tracking-tight leading-tight mt-0.5">{jumlahSelisih}</p>
            <p className="text-[11px] text-slate-400 dark:text-fg-muted mt-0.5">qty terima ≠ qty kirim</p>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200/80 dark:border-line bg-white dark:bg-surface shadow-2xs p-4">
        <div className="flex items-center gap-2.5 flex-wrap mb-3.5">
          <div className="relative flex items-center flex-1 min-w-[200px] sm:max-w-[280px]">
            <Search className="w-3.5 h-3.5 text-slate-400 dark:text-fg-muted absolute left-3.5 pointer-events-none" />
            <input
              type="text"
              placeholder="Cari no. distribusi atau booth..."
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

          <div className="flex gap-2">
            {([
              ["SEMUA", "Semua"],
              ["MENUNGGU", "Menunggu"],
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
                  <th className="py-3.5 px-3">No. Distribusi</th>
                  <th className="py-3.5 px-3">Booth</th>
                  <th className="py-3.5 px-3">Dikirim</th>
                  <th className="py-3.5 px-3">Diterima</th>
                  <th className="py-3.5 px-3">Petugas</th>
                  <th className="py-3.5 px-3 text-right">Item</th>
                  <th className="py-3.5 px-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-line bg-white dark:bg-surface">
                {filtered.map((d) => {
                  const status = STATUS_LABEL[d.status];
                  const terbuka = expandedId === d.id;
                  return (
                    <Fragment key={d.id}>
                      <tr
                        onClick={() => setExpandedId(terbuka ? null : d.id)}
                        className={`cursor-pointer hover:bg-brand-50/20 dark:hover:bg-surface-hover/40 transition-colors ${terbuka ? "bg-brand-50/30 dark:bg-surface-hover/50" : ""}`}
                      >
                        <td className="py-3 px-3 font-mono font-bold">
                          <div className="flex items-center gap-1.5">
                            <ChevronDown className={`w-3.5 h-3.5 text-slate-400 shrink-0 transition-transform ${terbuka ? "rotate-180" : ""}`} />
                            <span>{d.distributionNo}</span>
                          </div>
                        </td>
                        <td className="py-3 px-3 font-semibold text-slate-800 dark:text-fg">{d.boothName}</td>
                        <td className="py-3 px-3 text-slate-600 dark:text-fg-secondary whitespace-nowrap">{waktuJakarta(d.sentAt)}</td>
                        <td className="py-3 px-3 text-slate-600 dark:text-fg-secondary whitespace-nowrap">{waktuJakarta(d.receivedAt)}</td>
                        <td className="py-3 px-3 text-slate-700 dark:text-fg-secondary">{d.receivedByName ?? "-"}</td>
                        <td className="py-3 px-3 text-right tabular-nums text-slate-700 dark:text-fg-secondary">{d.items.length}</td>
                        <td className="py-3 px-3 text-center">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${status.kelas}`}>
                            {status.label}
                          </span>
                        </td>
                      </tr>

                      {terbuka && (
                        <tr className="bg-slate-50/60 dark:bg-surface-hover/30">
                          <td colSpan={7} className="p-0">
                            <div className="p-4 space-y-3">
                              <div className="overflow-x-auto rounded-lg border border-slate-200/70 dark:border-line bg-white dark:bg-surface">
                                <table className="w-full text-xs">
                                  <thead className="bg-slate-100/70 dark:bg-surface-hover text-[11px] font-bold text-slate-600 dark:text-fg-secondary">
                                    <tr>
                                      <th className="py-2 px-3 text-left">Produk</th>
                                      <th className="py-2 px-3 text-right">Qty Kirim</th>
                                      <th className="py-2 px-3 text-right">Qty Terima</th>
                                      <th className="py-2 px-3 text-right">Selisih</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-100 dark:divide-line">
                                    {d.items.map((item) => {
                                      const selisih = (item.qtyReceived ?? item.qtySent) - item.qtySent;
                                      return (
                                        <tr key={item.id}>
                                          <td className="py-2 px-3 text-slate-800 dark:text-fg font-medium">{item.productName}</td>
                                          <td className="py-2 px-3 text-right tabular-nums">{item.qtySent}</td>
                                          <td className="py-2 px-3 text-right tabular-nums font-semibold">{item.qtyReceived ?? "-"}</td>
                                          <td
                                            className={`py-2 px-3 text-right tabular-nums font-semibold ${
                                              selisih === 0 ? "text-slate-400 dark:text-fg-muted" : "text-rose-600 dark:text-rose-400"
                                            }`}
                                          >
                                            {item.qtyReceived == null ? "-" : selisih > 0 ? `+${selisih}` : selisih}
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                              {d.note && <p className="text-xs text-slate-500 dark:text-fg-muted">Catatan: {d.note}</p>}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}

                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={7} className="text-center text-slate-500 dark:text-fg-muted py-10 text-xs">
                      Tidak ada dokumen Terima Stok yang cocok.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default function TransaksiTerimaStokPage() {
  return (
    <RequireAuth>
      <TransaksiTerimaStokContent />
    </RequireAuth>
  );
}
