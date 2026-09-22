"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowUpDown,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
  FileText,
  Filter,
  ImageOff,
  MoreVertical,
  Package,
  PackageCheck,
  PackageX,
  Pencil,
  Plus,
  Power,
  Search,
  Boxes,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ColumnVisibilityMenu } from "@/components/ui/ColumnVisibilityMenu";
import { PortalMenu } from "@/components/ui/PortalMenu";
import { useToast } from "@/components/ui/Toast";
import { useColumnVisibility, type ColumnDef } from "@/lib/use-column-visibility";
import { getPageWindow } from "@/lib/pagination";
import { useHotkey } from "@/hooks/useHotkey";
import {
  api,
  ApiError,
  type FilterLaporanProduk,
  type Product,
  type ProductCategory,
  type RingkasStokProduk,
} from "@/lib/api-client";
import { ProdukReportPreviewModal } from "./ProdukReportPreviewModal";

function formatRupiah(n: number) {
  return `Rp${n.toLocaleString("id-ID")}`;
}

function angka(n: number) {
  return n.toLocaleString("id-ID");
}

const KOLOM_TERSEDIA: ColumnDef[] = [
  { key: "photo", label: "Foto" },
  { key: "code", label: "Kode" },
  { key: "name", label: "Nama Barang" },
  { key: "kategori", label: "Kategori" },
  { key: "hargaJual", label: "Harga Jual" },
  { key: "totalStok", label: "Total Stok" },
  { key: "status", label: "Status" },
  { key: "action", label: "Aksi" },
];

const OPSI_STATUS = [
  { value: "", label: "Semua Status" },
  { value: "active", label: "Aktif" },
  { value: "inactive", label: "Nonaktif" },
] as const;

/// Tab Main — daftar produk. Pola tampilan & cara kerjanya mengikuti
/// `ProdukPanel.tsx` di jsBerkah: chip filter aktif, kartu ringkasan yang ikut
/// menyusut mengikuti filter, dropdown filter, toggle kolom, sort header,
/// baris yang bisa dibuka, menu titik-tiga ber-portal, dan paginasi ber-URL.
///
/// Keadaan penyaring & halaman ditulis ke URL lewat `history.replaceState`,
/// bukan navigasi Next — supaya URL tetap bisa di-bookmark tanpa menembak
/// backend tiap ketikan.
export function TabMain({
  products,
  categories,
  ringkas,
  periode,
  onReload,
}: {
  products: Product[];
  categories: ProductCategory[];
  ringkas: Map<string, RingkasStokProduk>;
  periode: { bulan: number; tahun: number };
  onReload: () => Promise<void>;
}) {
  const toast = useToast();

  const [search, setSearch] = useState("");
  const [kategoriFilter, setKategoriFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [isFilterMenuOpen, setIsFilterMenuOpen] = useState(false);
  const [showReportPreview, setShowReportPreview] = useState(false);
  const [unduhExcel, setUnduhExcel] = useState(false);
  const filterMenuRef = useRef<HTMLDivElement>(null);

  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const { isVisible: tampil, toggle: toggleColumn } = useColumnVisibility("master-produk", KOLOM_TERSEDIA);

  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [actionMenuRowId, setActionMenuRowId] = useState<string | null>(null);
  const [actionMenuAnchor, setActionMenuAnchor] = useState<HTMLElement | null>(null);

  const [togglingId, setTogglingId] = useState<string | null>(null);
  const router = useRouter();

  // Keadaan daftar dibaca dari URL setelah mount, bukan saat inisialisasi state:
  // render pertama harus sama dengan hasil server, kalau tidak React protes
  // hydration mismatch begitu URL sudah membawa ?q= atau ?page=.
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    setSearch(p.get("q") ?? "");
    setKategoriFilter(p.get("kategori") ?? "");
    setStatusFilter(p.get("status") ?? "");
    setCurrentPage(Number(p.get("page") ?? "1") || 1);
    const expand = p.get("expand");
    if (expand) setExpandedRows(new Set([expand]));
  }, []);

  function updateUrlParam(key: string, value: string) {
    const params = new URLSearchParams(window.location.search);
    if (value) params.set(key, value);
    else params.delete(key);
    const qs = params.toString();
    window.history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname);
  }

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (filterMenuRef.current && !filterMenuRef.current.contains(e.target as Node)) setIsFilterMenuOpen(false);
      if (!(e.target as HTMLElement).closest?.("[data-action-menu]")) setActionMenuRowId(null);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function toggleExpandRow(id: string) {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleSort(colKey: string) {
    if (sortColumn === colKey) setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortColumn(colKey);
      setSortDirection("asc");
    }
  }

  const stokTotal = (id: string) => ringkas.get(id)?.total.saldoAkhir ?? 0;

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => {
      if (q && !`${p.sku} ${p.name} ${p.category ?? ""}`.toLowerCase().includes(q)) return false;
      if (kategoriFilter) {
        const nama = categories.find((c) => c.id === kategoriFilter)?.name;
        if (p.category !== nama) return false;
      }
      if (statusFilter === "active" && !p.active) return false;
      if (statusFilter === "inactive" && p.active) return false;
      return true;
    });
  }, [products, categories, search, kategoriFilter, statusFilter]);

  /// Kartu dihitung dari baris yang LOLOS penyaring, bukan seluruh master —
  /// kalau tidak, menyaring "Kopi · Nonaktif" menyisakan 3 baris di tabel
  /// sementara kartunya masih memajang angka seluruh katalog, dan dua angka
  /// berdampingan di satu layar pasti dibaca sebagai satu kesatuan.
  const metrics = useMemo(() => {
    const aktif = filteredRows.filter((p) => p.active);
    return {
      total: filteredRows.length,
      aktif: aktif.length,
      nonaktif: filteredRows.length - aktif.length,
      stok: filteredRows.reduce((s, p) => s + stokTotal(p.id), 0),
      totalSemua: products.length,
      aktifSemua: products.filter((p) => p.active).length,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [products, filteredRows, ringkas]);

  const sortedRows = useMemo(() => {
    const list = [...filteredRows];
    list.sort((a, b) => {
      if (!sortColumn) return a.sku.localeCompare(b.sku);
      let valA: string | number = "";
      let valB: string | number = "";
      if (sortColumn === "code") {
        valA = a.sku.toLowerCase();
        valB = b.sku.toLowerCase();
      } else if (sortColumn === "name") {
        valA = a.name.toLowerCase();
        valB = b.name.toLowerCase();
      } else if (sortColumn === "hargaJual") {
        valA = a.sellPrice;
        valB = b.sellPrice;
      } else if (sortColumn === "totalStok") {
        valA = stokTotal(a.id);
        valB = stokTotal(b.id);
      }
      if (valA < valB) return sortDirection === "asc" ? -1 : 1;
      if (valA > valB) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredRows, sortColumn, sortDirection, ringkas]);

  const totalItems = sortedRows.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  // Halaman dari URL bisa melebihi jumlah halaman yang tersisa; dijepit di sini
  // supaya tabelnya tidak tampil kosong melompong.
  const halamanAktif = Math.min(currentPage, totalPages);
  const nomorHalaman = useMemo(() => getPageWindow(halamanAktif, totalPages), [halamanAktif, totalPages]);
  const startIndex = (halamanAktif - 1) * pageSize;
  const paginatedRows = sortedRows.slice(startIndex, startIndex + pageSize);

  /// Keadaan daftar saat ini (penyaring + halaman), dititipkan ke tautan
  /// tambah/edit sebagai `back`. Tombol Back browser sebenarnya sudah cukup
  /// (URL daftar di-replaceState tiap penyaring berubah), tapi ini menutup jalur
  /// yang TIDAK lewat Back: setelah Simpan, form harus mengembalikan pemakai ke
  /// halaman 4 yang tadi ditinggalkan, bukan ke halaman 1.
  const kembaliKe = useMemo(() => {
    const params = new URLSearchParams();
    if (search) params.set("q", search);
    if (kategoriFilter) params.set("kategori", kategoriFilter);
    if (statusFilter) params.set("status", statusFilter);
    if (halamanAktif > 1) params.set("page", String(halamanAktif));
    const qs = params.toString();
    return qs ? `back=${encodeURIComponent(qs)}` : "";
  }, [search, kategoriFilter, statusFilter, halamanAktif]);

  const linkBaru = `/master/produk/baru${kembaliKe ? `?${kembaliKe}` : ""}`;
  const linkEdit = (id: string) => `/master/produk/${id}/edit${kembaliKe ? `?${kembaliKe}` : ""}`;

  // Dipasang SESUDAH `linkBaru` dibangun dan lewat useHotkey yang menaruh
  // handler-nya di dependensi — kalau pakai useEffect berdeps kosong, tautan
  // yang tertangkap adalah milik render pertama, jadi Ctrl+N kehilangan
  // penyaring & halaman yang sedang aktif.
  useHotkey({ key: "n", ctrl: true, allowInEditable: true }, () => router.push(linkBaru));

  const namaKategori = (id: string) => categories.find((c) => c.id === id)?.name ?? "-";

  const chipsPenyaring = useMemo(() => {
    const daftar: { key: string; label: string; nilai: string; hapus: () => void }[] = [];
    const reset = (setter: (v: string) => void, key: string) => () => {
      setter("");
      updateUrlParam(key, "");
      setCurrentPage(1);
      updateUrlParam("page", "");
    };
    if (search.trim()) daftar.push({ key: "q", label: "Pencarian", nilai: `"${search.trim()}"`, hapus: reset(setSearch, "q") });
    if (kategoriFilter)
      daftar.push({ key: "kategori", label: "Kategori", nilai: namaKategori(kategoriFilter), hapus: reset(setKategoriFilter, "kategori") });
    if (statusFilter)
      daftar.push({
        key: "status",
        label: "Status",
        nilai: statusFilter === "active" ? "Aktif" : "Nonaktif",
        hapus: reset(setStatusFilter, "status"),
      });
    return daftar;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, kategoriFilter, statusFilter, categories]);

  const adaPenyaring = chipsPenyaring.length > 0;
  const jumlahPenyaringAktif = (kategoriFilter ? 1 : 0) + (statusFilter ? 1 : 0);
  const jumlahKolomTampil = KOLOM_TERSEDIA.filter((k) => tampil(k.key)).length + 1;

  function bersihkanSemuaPenyaring() {
    setSearch("");
    setKategoriFilter("");
    setStatusFilter("");
    setCurrentPage(1);
    for (const key of ["q", "kategori", "status", "page"]) updateUrlParam(key, "");
  }

  const filterLaporan: FilterLaporanProduk = useMemo(
    () => ({
      q: search.trim() || undefined,
      kategoriId: kategoriFilter || undefined,
      status: statusFilter === "active" || statusFilter === "inactive" ? statusFilter : undefined,
    }),
    [search, kategoriFilter, statusFilter],
  );

  async function toggleAktif(product: Product) {
    setTogglingId(product.id);
    try {
      await api.updateProduct(product.id, { active: !product.active });
      toast.success(`Produk "${product.name}" ${product.active ? "dinonaktifkan" : "diaktifkan"}.`);
      await onReload();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Gagal mengubah status Produk.");
    } finally {
      setTogglingId(null);
    }
  }

  async function unduhLaporanExcel() {
    setUnduhExcel(true);
    try {
      const blob = await api.getProductReport("excel", filterLaporan);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `daftar-produk-${periode.tahun}-${String(periode.bulan).padStart(2, "0")}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Gagal mengunduh Excel.");
    } finally {
      setUnduhExcel(false);
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
      label: "Total Produk",
      nilai: angka(metrics.total),
      ket: adaPenyaring ? `dari ${metrics.totalSemua} produk` : "item terdaftar",
      icon: Package,
      skin: "bg-brand-50 dark:bg-brand-900/20 text-[var(--brand-700)] dark:text-brand-400 border-brand-100 dark:border-brand-900/30",
    },
    {
      label: "Produk Aktif",
      nilai: angka(metrics.aktif),
      ket: adaPenyaring ? `dari ${metrics.aktifSemua} aktif keseluruhan` : "bisa dijual & didistribusi",
      icon: PackageCheck,
      skin: "bg-brand-50 dark:bg-brand-900/20 text-brand-600 dark:text-brand-400 border-brand-100 dark:border-brand-900/30",
    },
    {
      label: "Nonaktif",
      nilai: angka(metrics.nonaktif),
      ket: "disembunyikan dari transaksi",
      icon: PackageX,
      skin: "bg-slate-100 dark:bg-surface-hover text-slate-500 dark:text-fg-muted border-slate-200 dark:border-line",
    },
    {
      label: "Total Stok",
      nilai: angka(metrics.stok),
      ket: "cup, gudang + seluruh booth",
      icon: Boxes,
      skin: "bg-violet-50 dark:bg-violet-900/20 text-violet-600 dark:text-violet-400 border-violet-100 dark:border-violet-900/30",
    },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-brand-50 dark:bg-brand-500/10 text-[var(--brand-700)] dark:text-brand-400 flex items-center justify-center flex-shrink-0 border border-brand-100 dark:border-brand-500/20 shadow-2xs">
            <Package className="w-4.5 h-4.5" />
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-fg tracking-tight leading-tight">Produk</h1>
            <p className="text-xs text-slate-500 dark:text-fg-muted font-normal mt-0.5">
              Katalog produk siap jual — klik kode atau namanya untuk mengubah.
            </p>
          </div>
        </div>

        <Link href={linkBaru}>
          <Button variant="primary" size="sm" leftIcon={<Plus className="w-3.5 h-3.5" />}>
            Tambah Produk <span className="ml-1 text-[10px] font-mono opacity-80">(Ctrl+N)</span>
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
            menampilkan {filteredRows.length} dari {metrics.totalSemua} produk
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
              placeholder="Cari kode, nama, kategori..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                updateUrlParam("q", e.target.value);
                setCurrentPage(1);
                updateUrlParam("page", "");
              }}
              className="w-full h-9 pl-9 pr-3.5 text-xs sm:text-sm font-medium rounded-xl bg-white/90 dark:bg-surface border border-slate-200/90 dark:border-line text-slate-800 dark:text-fg placeholder:text-slate-400 dark:placeholder:text-fg-muted focus:outline-none focus:border-[var(--brand-700)] focus:ring-2 focus:ring-[var(--brand-700)]/10 transition-colors shadow-2xs"
            />
          </div>

          <div className="flex flex-1 flex-wrap items-center gap-2 md:justify-end">
            <p className="text-xs font-semibold text-slate-600 dark:text-fg-muted md:text-right md:mr-0.5">
              {adaPenyaring ? "Hasil filter" : "Semua Produk"}
              <span className="font-normal text-slate-400 dark:text-fg-muted"> · {filteredRows.length} produk</span>
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
                <div className="absolute right-0 mt-1.5 w-56 rounded-xl border border-slate-200 dark:border-line bg-white dark:bg-surface p-1.5 shadow-xl z-50">
                  <p className="px-3 pt-1 pb-1.5 text-[10px] font-bold text-slate-400 dark:text-fg-muted uppercase tracking-wider">Kategori</p>
                  {[{ id: "", name: "Semua Kategori" }, ...categories].map((c) => (
                    <button
                      key={c.id || "all"}
                      type="button"
                      onClick={() => {
                        setKategoriFilter(c.id);
                        updateUrlParam("kategori", c.id);
                        setCurrentPage(1);
                        updateUrlParam("page", "");
                      }}
                      className={`w-full flex items-center justify-between px-3 py-1.5 text-xs font-semibold rounded-lg text-left cursor-pointer transition-colors ${
                        kategoriFilter === c.id
                          ? "bg-brand-50 text-[var(--brand-700)] dark:bg-brand-900/30 dark:text-brand-300"
                          : "text-slate-700 dark:text-fg-secondary hover:bg-slate-100/70 dark:hover:bg-surface-hover"
                      }`}
                    >
                      <span>{c.name}</span>
                      {kategoriFilter === c.id && <Check className="w-3.5 h-3.5 text-[var(--brand-700)]" />}
                    </button>
                  ))}

                  <div className="my-1.5 border-t border-slate-200/70 dark:border-line" />
                  <p className="px-3 pt-1 pb-1.5 text-[10px] font-bold text-slate-400 dark:text-fg-muted uppercase tracking-wider">Status</p>
                  {OPSI_STATUS.map((opt) => (
                    <button
                      key={opt.value || "all"}
                      type="button"
                      onClick={() => {
                        setStatusFilter(opt.value);
                        updateUrlParam("status", opt.value);
                        setCurrentPage(1);
                        updateUrlParam("page", "");
                      }}
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

            <button
              type="button"
              onClick={() => setShowReportPreview(true)}
              title="Pratinjau & cetak PDF daftar produk sesuai filter di layar"
              className="flex items-center gap-1.5 px-3 h-9 rounded-xl bg-white/90 dark:bg-surface hover:bg-slate-50 dark:hover:bg-surface-hover border border-slate-200/90 dark:border-line shadow-2xs text-xs font-semibold text-slate-700 dark:text-fg-secondary cursor-pointer transition-colors"
            >
              <FileText className="w-3.5 h-3.5 text-slate-400" />
              <span>PDF</span>
            </button>

            <button
              type="button"
              onClick={unduhLaporanExcel}
              disabled={unduhExcel}
              title="Unduh Excel daftar produk sesuai filter di layar"
              className="flex items-center gap-1.5 px-3 h-9 rounded-xl bg-white/90 dark:bg-surface hover:bg-slate-50 dark:hover:bg-surface-hover border border-slate-200/90 dark:border-line shadow-2xs text-xs font-semibold text-slate-700 dark:text-fg-secondary cursor-pointer transition-colors disabled:opacity-50"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-slate-400" />
              <span>{unduhExcel ? "Menyiapkan..." : "Excel"}</span>
            </button>
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-200/70 dark:border-line">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="bg-brand-50/70 dark:bg-surface-hover/80 text-[11px] font-bold text-slate-700 dark:text-fg-secondary border-b border-slate-200/80 dark:border-line">
                <th className="w-10 py-3.5 px-3 text-center" aria-label="Expand" />
                {tampil("photo") && <th className="py-3.5 px-3 text-center w-28">Foto</th>}
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
                      <span>Nama Barang</span>
                      <ArrowUpDown className="w-3.5 h-3.5 opacity-70" />
                    </button>
                  </th>
                )}
                {tampil("kategori") && <th className="py-3.5 px-3">Kategori</th>}
                {tampil("hargaJual") && (
                  <th className="py-3.5 px-3 text-right">
                    <button
                      type="button"
                      onClick={() => handleSort("hargaJual")}
                      className="flex items-center gap-1.5 ml-auto hover:text-[var(--brand-700)] transition-colors cursor-pointer"
                    >
                      <span>Harga Jual</span>
                      <ArrowUpDown className="w-3.5 h-3.5 opacity-70" />
                    </button>
                  </th>
                )}
                {tampil("totalStok") && (
                  <th className="py-3.5 px-3 text-right">
                    <button
                      type="button"
                      onClick={() => handleSort("totalStok")}
                      className="flex items-center gap-1.5 ml-auto hover:text-[var(--brand-700)] transition-colors cursor-pointer"
                    >
                      <span>Total Stok</span>
                      <ArrowUpDown className="w-3.5 h-3.5 opacity-70" />
                    </button>
                  </th>
                )}
                {tampil("status") && <th className="py-3.5 px-3 text-center">Status</th>}
                {tampil("action") && <th className="py-3.5 px-3 text-center w-16">Aksi</th>}
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 dark:divide-line bg-white dark:bg-surface">
              {paginatedRows.length > 0 ? (
                paginatedRows.map((p) => {
                  const isExpanded = expandedRows.has(p.id);
                  const r = ringkas.get(p.id);
                  return (
                    <React.Fragment key={p.id}>
                      <tr className="hover:bg-brand-50/20 dark:hover:bg-surface-hover/40 transition-colors">
                        <td className="py-3 px-3 text-center">
                          <button
                            type="button"
                            onClick={() => toggleExpandRow(p.id)}
                            className="w-7 h-7 rounded-full bg-brand-50 dark:bg-brand-900/20 text-[var(--brand-700)] dark:text-brand-400 border border-brand-200/80 dark:border-brand-800/40 flex items-center justify-center hover:bg-brand-100 dark:hover:bg-brand-900/40 transition-colors cursor-pointer"
                            title={isExpanded ? "Tutup Rincian" : "Buka Rincian"}
                          >
                            <ChevronRight className={`w-3.5 h-3.5 transition-transform duration-200 ${isExpanded ? "rotate-90" : ""}`} />
                          </button>
                        </td>

                        {tampil("photo") && (
                          <td className="py-3 px-3">
                            {/* Kotak 1:1 tetap digambar walau fotonya belum ada — kalau
                                petaknya ikut hilang, tinggi baris jadi tidak seragam dan
                                tabelnya terbaca bergoyang saat digulir. */}
                            <div className="relative w-20 aspect-square mx-auto rounded-lg overflow-hidden border border-slate-200/90 dark:border-line bg-slate-50 dark:bg-surface-hover/40 flex items-center justify-center">
                              {p.imageUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={p.imageUrl} alt={`Foto ${p.name}`} className="w-full h-full object-cover" />
                              ) : (
                                <ImageOff className="w-6 h-6 text-slate-300 dark:text-fg-muted" />
                              )}
                            </div>
                          </td>
                        )}

                        {tampil("code") && (
                          <td className="py-3 px-3 font-mono font-bold">
                            <Link
                              href={linkEdit(p.id)}
                              className="text-[var(--brand-700)] dark:text-brand-400 hover:underline"
                              title="Ubah produk ini"
                            >
                              {p.sku}
                            </Link>
                          </td>
                        )}

                        {tampil("name") && (
                          <td className="py-3 px-3">
                            <Link
                              href={linkEdit(p.id)}
                              className="font-bold text-slate-800 dark:text-fg hover:text-[var(--brand-700)] dark:hover:text-brand-400 hover:underline"
                              title="Ubah produk ini"
                            >
                              {p.name}
                            </Link>
                          </td>
                        )}

                        {tampil("kategori") && (
                          <td className="py-3 px-3 text-slate-600 dark:text-fg-muted">{p.category ?? "—"}</td>
                        )}

                        {tampil("hargaJual") && (
                          <td className="py-3 px-3 text-right font-semibold tabular-nums text-slate-800 dark:text-fg">
                            {formatRupiah(p.sellPrice)}
                          </td>
                        )}

                        {tampil("totalStok") && (
                          <td className="py-3 px-3 text-right">
                            <button
                              type="button"
                              onClick={() => toggleExpandRow(p.id)}
                              className="font-extrabold text-slate-900 dark:text-fg hover:text-[var(--brand-700)] dark:hover:text-brand-400 cursor-pointer transition-colors tabular-nums"
                              title="Lihat rincian per lokasi"
                            >
                              {angka(stokTotal(p.id))}
                            </button>
                          </td>
                        )}

                        {tampil("status") && <td className="py-3 px-3 text-center">{renderStatusBadge(p.active)}</td>}

                        {tampil("action") && (
                          <td className="py-3 px-3 text-center">
                            <div className="flex items-center justify-center">
                              {/* `data-action-menu` WAJIB ada di pembungkus ini — penutup-saat-
                                  klik-di-luar memeriksanya, dan tanpa itu menunya tertutup
                                  sebelum isinya sempat diklik. */}
                              <div className="relative" data-action-menu>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const buka = actionMenuRowId !== p.id;
                                    setActionMenuAnchor(buka ? e.currentTarget : null);
                                    setActionMenuRowId(buka ? p.id : null);
                                  }}
                                  className={`w-8 h-8 rounded-lg border border-slate-200/90 dark:border-line flex items-center justify-center text-slate-600 dark:text-fg-muted hover:text-[var(--brand-700)] dark:hover:text-brand-400 shadow-2xs cursor-pointer transition-colors ${
                                    actionMenuRowId === p.id
                                      ? "bg-brand-50 text-[var(--brand-700)] border-brand-300"
                                      : "bg-white/80 dark:bg-surface hover:bg-slate-50"
                                  }`}
                                  title="Aksi Lainnya"
                                >
                                  <MoreVertical className="w-4 h-4" />
                                </button>

                                {/* Di-portal ke body: pembungkus tabel ber-`overflow-x-auto`
                                    memotong menu yang menempel di dalam baris. */}
                                <PortalMenu
                                  open={actionMenuRowId === p.id}
                                  anchor={actionMenuAnchor}
                                  width={216}
                                  onClose={() => setActionMenuRowId(null)}
                                  className="rounded-xl bg-white dark:bg-surface border border-slate-200/90 dark:border-line shadow-xl py-1.5 text-left"
                                >
                                  <Link
                                    href={linkEdit(p.id)}
                                    onClick={() => setActionMenuRowId(null)}
                                    className="w-full flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-fg hover:bg-slate-50 dark:hover:bg-surface-hover transition-colors text-left"
                                  >
                                    <Pencil className="w-3.5 h-3.5 text-[var(--brand-700)]" />
                                    <span>Edit Produk</span>
                                  </Link>

                                  <div className="my-1 border-t border-slate-100 dark:border-line" />

                                  {/* Menggantikan "Hapus Produk" di jsBerkah: produk Obbel tidak
                                      pernah dihapus karena SaleItem lama menunjuk ke sini, dan
                                      backend memang tidak menyediakan endpoint hapus. */}
                                  <button
                                    type="button"
                                    disabled={togglingId === p.id}
                                    onClick={() => {
                                      setActionMenuRowId(null);
                                      toggleAktif(p);
                                    }}
                                    className={`w-full flex items-center gap-2 px-3.5 py-2 text-xs font-semibold transition-colors text-left cursor-pointer disabled:opacity-50 ${
                                      p.active
                                        ? "text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20"
                                        : "text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-950/20"
                                    }`}
                                  >
                                    <Power className="w-3.5 h-3.5" />
                                    <span>{p.active ? "Nonaktifkan" : "Aktifkan"}</span>
                                  </button>
                                </PortalMenu>
                              </div>
                            </div>
                          </td>
                        )}
                      </tr>

                      {isExpanded && (
                        <tr className="bg-slate-50/60 dark:bg-surface-hover/30">
                          <td colSpan={jumlahKolomTampil} className="p-3 sm:p-4">
                            <div className="rounded-xl border border-slate-200/70 dark:border-line bg-white dark:bg-surface ml-4 sm:ml-8">
                              <div className="overflow-x-auto">
                                <table className="w-full text-xs">
                                  <thead className="bg-brand-50/70 dark:bg-surface-hover text-[11px] font-bold text-slate-500 dark:text-fg-muted uppercase">
                                    <tr>
                                      <th className="text-center px-3.5 py-2 w-10">No.</th>
                                      <th className="text-left px-3.5 py-2">Lokasi</th>
                                      <th className="text-right px-3.5 py-2">Saldo Awal</th>
                                      <th className="text-right px-3.5 py-2">Masuk</th>
                                      <th className="text-right px-3.5 py-2">Keluar</th>
                                      <th className="text-right px-3.5 py-2">Akhir</th>
                                    </tr>
                                  </thead>

                                  <tbody className="divide-y divide-slate-100 dark:divide-line">
                                    {(r?.lokasi ?? []).map((l, i) => (
                                      <tr
                                        key={`${l.tipe}-${l.lokasiId}`}
                                        className="hover:bg-brand-50/30 dark:hover:bg-surface-hover/40 transition-colors"
                                      >
                                        <td className="px-3.5 py-2 text-center text-slate-500 dark:text-fg-muted">{i + 1}</td>
                                        <td className="px-3.5 py-2 font-bold text-slate-700 dark:text-fg-secondary">
                                          {l.tipe === "WAREHOUSE" ? l.nama : `Booth ${l.nama}`}
                                        </td>
                                        <td className="px-3.5 py-2 text-right tabular-nums text-slate-600 dark:text-fg-muted">
                                          {angka(l.saldoAwal)}
                                        </td>
                                        <td className="px-3.5 py-2 text-right tabular-nums font-semibold text-brand-600 dark:text-brand-400">
                                          {l.masuk ? `+${angka(l.masuk)}` : "—"}
                                        </td>
                                        <td className="px-3.5 py-2 text-right tabular-nums font-semibold text-rose-600 dark:text-rose-400">
                                          {l.keluar ? `−${angka(l.keluar)}` : "—"}
                                        </td>
                                        <td className="px-3.5 py-2 text-right tabular-nums font-bold text-slate-900 dark:text-fg">
                                          {angka(l.saldoAkhir)}
                                        </td>
                                      </tr>
                                    ))}

                                    {!r && (
                                      <tr>
                                        <td colSpan={6} className="px-3.5 py-6 text-center text-slate-400 dark:text-fg-muted">
                                          Data stok belum termuat.
                                        </td>
                                      </tr>
                                    )}
                                  </tbody>

                                  {r && (
                                    <tfoot className="bg-slate-50/80 dark:bg-surface-hover border-t-2 border-slate-200 dark:border-line text-[11px] font-bold text-slate-700 dark:text-fg-secondary">
                                      <tr>
                                        <td className="px-3.5 py-2" colSpan={2}>
                                          Total (cup)
                                        </td>
                                        <td className="px-3.5 py-2 text-right tabular-nums">{angka(r.total.saldoAwal)}</td>
                                        <td className="px-3.5 py-2 text-right tabular-nums text-brand-700 dark:text-brand-400">
                                          +{angka(r.total.masuk)}
                                        </td>
                                        <td className="px-3.5 py-2 text-right tabular-nums text-rose-700 dark:text-rose-400">
                                          −{angka(r.total.keluar)}
                                        </td>
                                        <td className="px-3.5 py-2 text-right tabular-nums font-black text-slate-900 dark:text-fg">
                                          {angka(r.total.saldoAkhir)}
                                        </td>
                                      </tr>
                                    </tfoot>
                                  )}
                                </table>
                              </div>

                              <p className="px-3.5 py-2 text-[10px] text-slate-400 dark:text-fg-muted">
                                Masuk &amp; Keluar periode {String(periode.bulan).padStart(2, "0")}/{periode.tahun} · Saldo Akhir
                                = stok yang ada sekarang
                                {r?.total.perluVerifikasi ? " · sebagian arah mutasi lama perlu diverifikasi" : ""}
                              </p>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={jumlahKolomTampil} className="text-center py-10 text-slate-500 dark:text-fg-muted">
                    {products.length === 0 ? "Belum ada Produk." : "Tidak ada produk yang cocok dengan filter."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mt-4 pt-3 border-t border-slate-100 dark:border-line text-xs font-semibold text-slate-600 dark:text-fg-muted">
          <div className="flex items-center gap-2">
            <span>Tampilkan</span>
            <div className="relative">
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                  updateUrlParam("page", "");
                }}
                className="h-8 pl-2.5 pr-7 rounded-lg bg-white dark:bg-surface border border-slate-200/90 dark:border-line text-slate-700 dark:text-fg-secondary cursor-pointer focus:outline-none appearance-none font-bold"
              >
                {[5, 10, 25, 50].map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3 h-3 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400" />
            </div>
            <span>dari {totalItems} data</span>
          </div>

          <div className="flex items-center gap-1 self-end sm:self-auto">
            <button
              type="button"
              disabled={halamanAktif <= 1}
              onClick={() => {
                const next = Math.max(1, halamanAktif - 1);
                setCurrentPage(next);
                updateUrlParam("page", next === 1 ? "" : String(next));
              }}
              className="w-8 h-8 rounded-lg border border-slate-200/90 dark:border-line flex items-center justify-center text-slate-600 dark:text-fg-muted hover:bg-slate-50 dark:hover:bg-surface-hover disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
              title="Halaman Sebelumnya"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            {nomorHalaman.map((pg) => (
              <button
                key={pg}
                type="button"
                onClick={() => {
                  setCurrentPage(pg);
                  updateUrlParam("page", pg === 1 ? "" : String(pg));
                }}
                className={`w-8 h-8 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                  halamanAktif === pg
                    ? "bg-[var(--brand-700)] text-white shadow-xs"
                    : "border border-slate-200/90 dark:border-line text-slate-700 dark:text-fg hover:bg-slate-50 dark:hover:bg-surface-hover"
                }`}
              >
                {pg}
              </button>
            ))}

            <button
              type="button"
              disabled={halamanAktif >= totalPages}
              onClick={() => {
                const next = Math.min(totalPages, halamanAktif + 1);
                setCurrentPage(next);
                updateUrlParam("page", next === 1 ? "" : String(next));
              }}
              className="w-8 h-8 rounded-lg border border-slate-200/90 dark:border-line flex items-center justify-center text-slate-600 dark:text-fg-muted hover:bg-slate-50 dark:hover:bg-surface-hover disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
              title="Halaman Berikutnya"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      <ProdukReportPreviewModal
        isOpen={showReportPreview}
        onClose={() => setShowReportPreview(false)}
        filter={filterLaporan}
      />
    </div>
  );
}
