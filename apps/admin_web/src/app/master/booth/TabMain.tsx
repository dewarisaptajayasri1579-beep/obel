"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowUpDown,
  Check,
  CheckCircle2,
  ChevronDown,
  Filter,
  MapPin,
  MoreVertical,
  Pencil,
  Plus,
  Power,
  Search,
  Store,
  X,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ColumnVisibilityMenu } from "@/components/ui/ColumnVisibilityMenu";
import { PortalMenu } from "@/components/ui/PortalMenu";
import { useToast } from "@/components/ui/Toast";
import { useColumnVisibility, type ColumnDef } from "@/lib/use-column-visibility";
import { useHotkey } from "@/hooks/useHotkey";
import { api, ApiError, type Booth } from "@/lib/api-client";

function angka(n: number) {
  return n.toLocaleString("id-ID");
}

const KOLOM_TERSEDIA: ColumnDef[] = [
  { key: "code", label: "Kode" },
  { key: "name", label: "Nama" },
  { key: "lokasi", label: "Lokasi" },
  { key: "koordinat", label: "Koordinat" },
  { key: "status", label: "Status" },
  { key: "action", label: "Aksi" },
];

const OPSI_STATUS = [
  { value: "", label: "Semua Status" },
  { value: "active", label: "Aktif" },
  { value: "inactive", label: "Nonaktif" },
] as const;

/// Tab Main — daftar Booth. Pola tampilan disamakan dengan Produk → Main
/// (kartu ringkasan, pencarian, filter status, toggle kolom, sort header, menu
/// aksi ber-portal, Tambah/Ubah lewat halaman tersendiri bukan modal — lihat
/// alasannya di `BoothForm`) — TANPA pengelompokan kategori (Booth tidak
/// punya konsep itu) dan TANPA export PDF/Excel (belum ada endpoint
/// laporannya di backend, beda dengan Produk yang sudah punya).
export function TabMain({ booths, onReload }: { booths: Booth[]; onReload: () => Promise<void> }) {
  const toast = useToast();
  const router = useRouter();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [isFilterMenuOpen, setIsFilterMenuOpen] = useState(false);
  const filterMenuRef = useRef<HTMLDivElement>(null);

  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  const { isVisible: tampil, toggle: toggleColumn } = useColumnVisibility("master-booth", KOLOM_TERSEDIA);

  const [actionMenuRowId, setActionMenuRowId] = useState<string | null>(null);
  const [actionMenuAnchor, setActionMenuAnchor] = useState<HTMLElement | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (filterMenuRef.current && !filterMenuRef.current.contains(e.target as Node)) setIsFilterMenuOpen(false);
      if (!(e.target as HTMLElement).closest?.("[data-action-menu]")) setActionMenuRowId(null);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function handleSort(colKey: string) {
    if (sortColumn === colKey) setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortColumn(colKey);
      setSortDirection("asc");
    }
  }

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return booths.filter((b) => {
      if (q && !`${b.code} ${b.name} ${b.locationName ?? ""} ${b.address ?? ""}`.toLowerCase().includes(q))
        return false;
      if (statusFilter === "active" && b.status !== "ACTIVE") return false;
      if (statusFilter === "inactive" && b.status !== "INACTIVE") return false;
      return true;
    });
  }, [booths, search, statusFilter]);

  const metrics = useMemo(() => {
    const aktif = filteredRows.filter((b) => b.status === "ACTIVE");
    const punyaLokasi = filteredRows.filter((b) => b.latitude !== null && b.longitude !== null);
    return {
      total: filteredRows.length,
      aktif: aktif.length,
      nonaktif: filteredRows.length - aktif.length,
      punyaLokasi: punyaLokasi.length,
      totalSemua: booths.length,
    };
  }, [booths, filteredRows]);

  const sortedRows = useMemo(() => {
    const list = [...filteredRows];
    list.sort((a, b) => {
      if (!sortColumn) return a.name.localeCompare(b.name);
      let valA = "";
      let valB = "";
      if (sortColumn === "code") {
        valA = a.code.toLowerCase();
        valB = b.code.toLowerCase();
      } else if (sortColumn === "name") {
        valA = a.name.toLowerCase();
        valB = b.name.toLowerCase();
      }
      if (valA < valB) return sortDirection === "asc" ? -1 : 1;
      if (valA > valB) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });
    return list;
  }, [filteredRows, sortColumn, sortDirection]);

  const chipsPenyaring = useMemo(() => {
    const daftar: { key: string; label: string; nilai: string; hapus: () => void }[] = [];
    if (search.trim()) daftar.push({ key: "q", label: "Pencarian", nilai: `"${search.trim()}"`, hapus: () => setSearch("") });
    if (statusFilter)
      daftar.push({
        key: "status",
        label: "Status",
        nilai: statusFilter === "active" ? "Aktif" : "Nonaktif",
        hapus: () => setStatusFilter(""),
      });
    return daftar;
  }, [search, statusFilter]);

  const adaPenyaring = chipsPenyaring.length > 0;
  const jumlahPenyaringAktif = statusFilter ? 1 : 0;
  const jumlahKolomTampil = KOLOM_TERSEDIA.filter((k) => tampil(k.key)).length;

  function bersihkanSemuaPenyaring() {
    setSearch("");
    setStatusFilter("");
  }

  /// Keadaan daftar saat ini (penyaring), dititipkan ke tautan tambah/edit
  /// sebagai `back` — sama seperti pola di Produk → Main.
  const kembaliKe = useMemo(() => {
    const params = new URLSearchParams();
    if (search) params.set("q", search);
    if (statusFilter) params.set("status", statusFilter);
    const qs = params.toString();
    return qs ? `back=${encodeURIComponent(qs)}` : "";
  }, [search, statusFilter]);

  const linkBaru = `/master/booth/baru${kembaliKe ? `?${kembaliKe}` : ""}`;
  const linkEdit = (id: string) => `/master/booth/${id}/edit${kembaliKe ? `?${kembaliKe}` : ""}`;

  useHotkey({ key: "n", ctrl: true, allowInEditable: true }, () => router.push(linkBaru));

  async function toggleAktif(b: Booth) {
    setTogglingId(b.id);
    try {
      const next = b.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
      await api.updateBooth(b.id, { status: next });
      toast.success(`Booth "${b.name}" ${next === "ACTIVE" ? "diaktifkan" : "dinonaktifkan"}.`);
      await onReload();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Gagal mengubah status Booth.");
    } finally {
      setTogglingId(null);
    }
  }

  const renderStatusBadge = (aktif: boolean) => (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold border ${
        aktif
          ? "bg-brand-50 dark:bg-brand-500/10 text-brand-700 dark:text-brand-400 border-brand-200/80 dark:border-brand-500/20"
          : "bg-slate-100 dark:bg-surface-hover text-slate-600 dark:text-fg-muted border-slate-200/80 dark:border-line"
      }`}
    >
      <span className={`w-2 h-2 rounded-full ${aktif ? "bg-brand-500" : "bg-slate-400"}`} />
      {aktif ? "Aktif" : "Nonaktif"}
    </span>
  );

  const KARTU = [
    {
      label: "Total Booth",
      nilai: angka(metrics.total),
      ket: adaPenyaring ? `dari ${metrics.totalSemua} booth` : "titik jualan terdaftar",
      icon: Store,
      skin: "bg-brand-50 dark:bg-brand-900/20 text-[var(--brand-700)] dark:text-brand-400 border-brand-100 dark:border-brand-900/30",
    },
    {
      label: "Booth Aktif",
      nilai: angka(metrics.aktif),
      ket: "bisa dipakai shift & transaksi",
      icon: CheckCircle2,
      skin: "bg-brand-50 dark:bg-brand-900/20 text-brand-600 dark:text-brand-400 border-brand-100 dark:border-brand-900/30",
    },
    {
      label: "Nonaktif",
      nilai: angka(metrics.nonaktif),
      ket: "tidak bisa dipakai transaksi",
      icon: XCircle,
      skin: "bg-slate-100 dark:bg-surface-hover text-slate-500 dark:text-fg-muted border-slate-200 dark:border-line",
    },
    {
      label: "Punya Titik Lokasi",
      nilai: `${angka(metrics.punyaLokasi)} / ${angka(metrics.total)}`,
      ket: "tampil di peta Monitoring",
      icon: MapPin,
      skin: "bg-violet-50 dark:bg-violet-900/20 text-violet-600 dark:text-violet-400 border-violet-100 dark:border-violet-900/30",
    },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-brand-50 dark:bg-brand-500/10 text-[var(--brand-700)] dark:text-brand-400 flex items-center justify-center flex-shrink-0 border border-brand-100 dark:border-brand-500/20 shadow-2xs">
            <Store className="w-4.5 h-4.5" />
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-fg tracking-tight leading-tight">Booth</h1>
            <p className="text-xs text-slate-500 dark:text-fg-muted font-normal mt-0.5">
              Daftar Booth — klik menu titik-tiga untuk mengubah atau menonaktifkan.
            </p>
          </div>
        </div>

        <Link href={linkBaru}>
          <Button variant="primary" size="sm" leftIcon={<Plus className="w-3.5 h-3.5" />}>
            Tambah Booth <span className="ml-1 text-[10px] font-mono opacity-80">(Ctrl+N)</span>
          </Button>
        </Link>
      </div>

      {adaPenyaring && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-brand-200/70 dark:border-brand-500/20 bg-brand-50/60 dark:bg-brand-500/5 px-3 py-2">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-[var(--brand-700)] dark:text-brand-400 uppercase tracking-wide">
            <Filter className="w-3.5 h-3.5" />
            Filter aktif
          </span>
          {chipsPenyaring.map((chip) => (
            <span
              key={chip.key}
              className="inline-flex items-center gap-1.5 pl-2.5 pr-1 py-0.5 rounded-full bg-white dark:bg-surface border border-brand-200/80 dark:border-brand-500/20 text-xs font-semibold text-slate-700 dark:text-fg-secondary shadow-2xs"
            >
              <span className="text-slate-400 dark:text-fg-muted font-bold text-[10px] uppercase tracking-wide">{chip.label}</span>
              <span>{chip.nilai}</span>
              <button
                type="button"
                onClick={chip.hapus}
                className="w-4 h-4 rounded-full flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 cursor-pointer transition-colors"
                title={`Hapus filter ${chip.label}`}
                aria-label={`Hapus filter ${chip.label}`}
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
          <span className="text-[11px] font-semibold text-slate-500 dark:text-fg-muted">
            menampilkan {filteredRows.length} dari {metrics.totalSemua} booth
          </span>
          <button
            type="button"
            onClick={bersihkanSemuaPenyaring}
            className="ml-auto text-[11px] font-bold text-[var(--brand-700)] dark:text-brand-400 hover:underline cursor-pointer"
          >
            Hapus semua filter
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {KARTU.map(({ label, nilai, ket, icon: Icon, skin }) => (
          <div
            key={label}
            className="rounded-xl border border-slate-200/80 dark:border-line bg-white/80 dark:bg-surface p-3.5 shadow-2xs flex items-center gap-3"
          >
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 border ${skin}`}>
              <Icon className="w-4.5 h-4.5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-slate-500 dark:text-fg-muted">{label}</p>
              <p className="text-lg sm:text-xl font-bold text-slate-900 dark:text-fg tracking-tight leading-tight mt-0.5 tabular-nums">
                {nilai}
              </p>
              <p className="text-[11px] text-slate-400 dark:text-fg-muted mt-0.5 truncate">{ket}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-slate-200/80 dark:border-line bg-white dark:bg-surface shadow-2xs p-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-3.5">
          <div className="relative flex items-center w-full sm:max-w-[180px] lg:max-w-[270px] sm:shrink-0">
            <Search className="w-3.5 h-3.5 text-slate-400 dark:text-fg-muted absolute left-3.5 pointer-events-none" />
            <input
              type="text"
              placeholder="Cari kode, nama, lokasi..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-9 pl-9 pr-3.5 text-xs sm:text-sm font-medium rounded-xl bg-white/90 dark:bg-surface border border-slate-200/90 dark:border-line text-slate-800 dark:text-fg placeholder:text-slate-400 dark:placeholder:text-fg-muted focus:outline-none focus:border-[var(--brand-700)] focus:ring-2 focus:ring-[var(--brand-700)]/10 transition-colors shadow-2xs"
            />
          </div>

          <div className="flex flex-1 flex-wrap items-center gap-2 md:justify-end">
            <p className="text-xs font-semibold text-slate-600 dark:text-fg-muted md:text-right md:mr-0.5">
              {adaPenyaring ? "Hasil filter" : "Semua Booth"}
              <span className="font-normal text-slate-400 dark:text-fg-muted"> · {filteredRows.length} booth</span>
            </p>

            <div className="relative" ref={filterMenuRef}>
              <button
                type="button"
                onClick={() => setIsFilterMenuOpen((o) => !o)}
                className="flex items-center gap-1.5 px-3 h-9 rounded-xl bg-white/90 dark:bg-surface hover:bg-slate-50 dark:hover:bg-surface-hover border border-slate-200/90 dark:border-line shadow-2xs text-xs font-semibold text-slate-700 dark:text-fg-secondary cursor-pointer transition-colors"
              >
                <Filter className="w-3.5 h-3.5 text-slate-400" />
                <span>Filter</span>
                {jumlahPenyaringAktif > 0 && (
                  <span className="min-w-4 h-4 px-1 rounded-full bg-[var(--brand-700)] text-white text-[10px] font-bold flex items-center justify-center">
                    {jumlahPenyaringAktif}
                  </span>
                )}
                <ChevronDown className="w-3 h-3 text-slate-400" />
              </button>

              {isFilterMenuOpen && (
                <div className="absolute right-0 mt-1.5 w-52 rounded-xl border border-slate-200 dark:border-line bg-white dark:bg-surface p-1.5 shadow-xl z-50">
                  <p className="px-3 pt-1 pb-1.5 text-[10px] font-bold text-slate-400 dark:text-fg-muted uppercase tracking-wider">Status</p>
                  {OPSI_STATUS.map((opt) => (
                    <button
                      key={opt.value || "all"}
                      type="button"
                      onClick={() => setStatusFilter(opt.value)}
                      className={`w-full flex items-center justify-between px-3 py-1.5 text-xs font-semibold rounded-lg text-left cursor-pointer transition-colors ${
                        statusFilter === opt.value
                          ? "bg-brand-50 text-[var(--brand-700)] dark:bg-brand-900/30 dark:text-brand-300"
                          : "text-slate-700 dark:text-fg-secondary hover:bg-slate-100/70 dark:hover:bg-surface-hover"
                      }`}
                    >
                      <span>{opt.label}</span>
                      {statusFilter === opt.value && <Check className="w-3.5 h-3.5 text-[var(--brand-700)]" />}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <ColumnVisibilityMenu columns={KOLOM_TERSEDIA} isVisible={tampil} onToggle={toggleColumn} />
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-200/70 dark:border-line">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="bg-brand-50/70 dark:bg-surface-hover/80 text-[11px] font-bold text-slate-700 dark:text-fg-secondary border-b border-slate-200/80 dark:border-line">
                {tampil("code") && (
                  <th className="py-3.5 px-3">
                    <button
                      type="button"
                      onClick={() => handleSort("code")}
                      className="flex items-center gap-1.5 hover:text-[var(--brand-700)] transition-colors cursor-pointer"
                    >
                      <span>Kode</span>
                      <ArrowUpDown className="w-3.5 h-3.5 opacity-70" />
                    </button>
                  </th>
                )}
                {tampil("name") && (
                  <th className="py-3.5 px-3">
                    <button
                      type="button"
                      onClick={() => handleSort("name")}
                      className="flex items-center gap-1.5 hover:text-[var(--brand-700)] transition-colors cursor-pointer"
                    >
                      <span>Nama</span>
                      <ArrowUpDown className="w-3.5 h-3.5 opacity-70" />
                    </button>
                  </th>
                )}
                {tampil("lokasi") && <th className="py-3.5 px-3">Lokasi</th>}
                {tampil("koordinat") && <th className="py-3.5 px-3">Koordinat</th>}
                {tampil("status") && <th className="py-3.5 px-3 text-center">Status</th>}
                {tampil("action") && <th className="py-3.5 px-3 text-center w-16">Aksi</th>}
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 dark:divide-line bg-white dark:bg-surface">
              {sortedRows.length === 0 ? (
                <tr>
                  <td colSpan={jumlahKolomTampil} className="text-center py-10 text-slate-500 dark:text-fg-muted">
                    {booths.length === 0 ? "Belum ada Booth." : "Tidak ada Booth yang cocok dengan filter."}
                  </td>
                </tr>
              ) : (
                sortedRows.map((b) => (
                  <tr key={b.id} className="hover:bg-brand-50/20 dark:hover:bg-surface-hover/40 transition-colors">
                    {tampil("code") && (
                      <td className="py-3 px-3 font-mono font-bold">
                        <Link
                          href={linkEdit(b.id)}
                          className="text-[var(--brand-700)] dark:text-brand-400 hover:underline"
                          title="Ubah Booth ini"
                        >
                          {b.code}
                        </Link>
                      </td>
                    )}
                    {tampil("name") && (
                      <td className="py-3 px-3">
                        <Link
                          href={linkEdit(b.id)}
                          className="font-bold text-slate-800 dark:text-fg hover:text-[var(--brand-700)] dark:hover:text-brand-400 hover:underline"
                          title="Ubah Booth ini"
                        >
                          {b.name}
                        </Link>
                      </td>
                    )}
                    {tampil("lokasi") && (
                      <td className="py-3 px-3 text-slate-600 dark:text-fg-muted">{b.locationName ?? "—"}</td>
                    )}
                    {tampil("koordinat") && (
                      <td className="py-3 px-3 text-slate-600 dark:text-fg-muted">
                        {b.latitude !== null && b.longitude !== null ? (
                          <span className="inline-flex items-center gap-1 font-mono text-[11px]">
                            <MapPin className="w-3 h-3 text-[var(--brand-700)] dark:text-brand-400 flex-shrink-0" />
                            {b.latitude.toFixed(6)}, {b.longitude.toFixed(6)}
                          </span>
                        ) : (
                          <span className="text-slate-400 dark:text-fg-muted italic">Belum diisi</span>
                        )}
                      </td>
                    )}
                    {tampil("status") && (
                      <td className="py-3 px-3 text-center">{renderStatusBadge(b.status === "ACTIVE")}</td>
                    )}
                    {tampil("action") && (
                      <td className="py-3 px-3 text-center">
                        <div className="flex items-center justify-center">
                          {/* `data-action-menu` WAJIB ada — sama seperti pola di Produk,
                              penutup-saat-klik-di-luar memeriksanya. */}
                          <div className="relative" data-action-menu>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                const buka = actionMenuRowId !== b.id;
                                setActionMenuAnchor(buka ? e.currentTarget : null);
                                setActionMenuRowId(buka ? b.id : null);
                              }}
                              className={`w-8 h-8 rounded-lg border border-slate-200/90 dark:border-line flex items-center justify-center text-slate-600 dark:text-fg-muted hover:text-[var(--brand-700)] dark:hover:text-brand-400 shadow-2xs cursor-pointer transition-colors ${
                                actionMenuRowId === b.id
                                  ? "bg-brand-50 text-[var(--brand-700)] border-brand-300"
                                  : "bg-white/80 dark:bg-surface hover:bg-slate-50"
                              }`}
                              title="Aksi Lainnya"
                            >
                              <MoreVertical className="w-4 h-4" />
                            </button>

                            <PortalMenu
                              open={actionMenuRowId === b.id}
                              anchor={actionMenuAnchor}
                              width={200}
                              onClose={() => setActionMenuRowId(null)}
                              className="rounded-xl bg-white dark:bg-surface border border-slate-200/90 dark:border-line shadow-xl py-1.5 text-left"
                            >
                              <Link
                                href={linkEdit(b.id)}
                                onClick={() => setActionMenuRowId(null)}
                                className="w-full flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-fg hover:bg-slate-50 dark:hover:bg-surface-hover transition-colors text-left"
                              >
                                <Pencil className="w-3.5 h-3.5 text-[var(--brand-700)]" />
                                <span>Edit Booth</span>
                              </Link>

                              <button
                                type="button"
                                disabled={togglingId === b.id}
                                onClick={() => {
                                  setActionMenuRowId(null);
                                  toggleAktif(b);
                                }}
                                className={`w-full flex items-center gap-2 px-3.5 py-2 text-xs font-semibold transition-colors text-left cursor-pointer disabled:opacity-50 ${
                                  b.status === "ACTIVE"
                                    ? "text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20"
                                    : "text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-950/20"
                                }`}
                              >
                                <Power className="w-3.5 h-3.5" />
                                <span>{b.status === "ACTIVE" ? "Nonaktifkan" : "Aktifkan"}</span>
                              </button>
                            </PortalMenu>
                          </div>
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
