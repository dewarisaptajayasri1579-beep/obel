"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Plus,
  MoreVertical,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  Search,
  Check,
  Package,
  PackageCheck,
  PackageX,
  Percent,
  ArrowUpDown,
  Pencil,
  Trash2,
  History,
  Filter,
  FileText,
  FileSpreadsheet,
  ImageOff,
  X,
  ExternalLink,
} from "lucide-react";
import { Button, ColumnVisibilityMenu, Modal, PortalMenu, useToast } from "@/components/ui";
import { HapusDialog } from "@/components/HapusDialog";
import { useColumnVisibility, type ColumnDef } from "@/lib/use-column-visibility";
import { useHotkey } from "@/hooks/useHotkey";
import { getPageWindow } from "@/lib/pagination";
import { saringProduk } from "@/lib/produk-filter";
import { formatRupiah, formatDate } from "@/lib/format";
import type { SaldoStok } from "./types";
import { ProdukReportPreviewModal } from "./ProdukReportPreviewModal";

export interface Produk {
  id: string;
  code: string;
  name: string;
  businessTypeId: string;
  category: string;
  variant: string;
  size: string;
  unit: string;
  sellPrice: number;
  costPrice: number;
  supplierId: string;
  consignmentPrice: number | null;
  minStock: number | null;
  photoUrl: string;
  isActive: boolean;
  /** Stok berjalan, dijumlahkan backend dari `StockLedger` (`GET /stock/produk/ringkas`).
   *  TIDAK lagi jadi kolom tabel (permintaan Owner) — empat kolom angka stok bikin baris produk
   *  terlalu padat sementara yang dicari biasanya rinciannya, bukan angka telanjangnya. Datanya
   *  tetap ditarik karena dipakai tabel rekap di panel rincian baris. */
  stokGudang: number;
  stokSales: number;
  stokToko: number;
  stokTotal: number;
  saldoGudang: SaldoStok;
  saldoSales: SaldoStok;
  saldoToko: SaldoStok;
}

interface RiwayatHargaRow {
  poNumber: string;
  date: string;
  status: string;
  qty: number;
  price: number;
}

/** Enam kolom (permintaan Owner) — No./Bisnis/Harga Jual/Harga Beli/Supplier dibuang dari
 *  daftar: rinciannya sudah ada di baris rincian (expand) dan halaman Edit, jadi mengulangnya
 *  di sini cuma bikin baris produk terlalu padat. Total Stok menggantikan tiga kolom angka stok
 *  yang sudah lebih dulu dipindah ke baris rincian (lihat catatan `stokGudang` dkk di atas). */
const KOLOM_TERSEDIA: ColumnDef[] = [
  { key: "photo", label: "Foto" },
  { key: "code", label: "Kode" },
  { key: "name", label: "Nama Produk" },
  { key: "totalStok", label: "Total Stok" },
  { key: "status", label: "Status" },
  { key: "action", label: "Aksi" },
];

const OPSI_STATUS = [
  { value: "", label: "Semua Status" },
  { value: "active", label: "Aktif" },
  { value: "inactive", label: "Nonaktif" },
] as const;

/** Daftar Master Produk — layout mirror `PurchaseOrderPanel.tsx` (kartu ringkasan, filter bar
 *  + PDF/Excel, expand-row rincian, kebab aksi, pagination ber-URL).
 *
 *  BEDA dari PO yang disalin polanya: di sini TIDAK ada checkbox/aksi massal (permintaan Owner —
 *  hapus produk itu satu-satu dan selalu disengaja), dan mengedit dilakukan dengan mengeklik
 *  kode/nama produknya langsung, bukan lewat menu. Formnya halaman tersendiri (`/baru`,
 *  `/[id]/edit`), bukan modal, supaya posisi daftar (halaman ke berapa, penyaring apa) tetap
 *  utuh di URL dan tombol Back browser mengembalikan pemakai persis ke tempat dia tadi. */
export function ProdukPanel({
  rows,
  businessTypes,
  periodeStok,
  canManage,
}: {
  rows: Produk[];
  businessTypes: { id: string; name: string }[];
  /** Periode yang dipakai kolom Debet/Kredit di tabel rincian (bawaan bulan berjalan, dihitung
   *  backend). `null` kalau data stoknya gagal diambil. */
  periodeStok: { from: string; to: string } | null;
  canManage: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const searchParams = useSearchParams();

  const businessTypeName = (id: string) => businessTypes.find((b) => b.id === id)?.name ?? "-";

  /** `window.history.replaceState` (didukung resmi Next 16, terintegrasi dengan `useSearchParams`),
   *  BUKAN `router.replace` — halaman produk ini server component yang menarik seluruh master data
   *  lewat `backendFetch`, jadi navigasi Next beneran per ketikan berarti backend ditembak ulang
   *  tiap huruf. Yang dibutuhkan cuma URL-nya bisa di-share/di-bookmark dan — ini yang penting di
   *  sini — jadi titik balik yang benar saat pemakai menekan Back dari halaman edit. */
  const updateUrlParam = (key: string, value: string) => {
    const params = new URLSearchParams(window.location.search);
    if (value) params.set(key, value);
    else params.delete(key);
    const qs = params.toString();
    window.history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname);
  };

  const [search, setSearch] = useState(() => searchParams.get("q") ?? "");
  const [bisnisFilter, setBisnisFilter] = useState(() => searchParams.get("bisnis") ?? "");
  const [statusFilter, setStatusFilter] = useState(() => searchParams.get("status") ?? "");
  const [isFilterMenuOpen, setIsFilterMenuOpen] = useState(false);
  const [showReportPreview, setShowReportPreview] = useState(false);
  const filterMenuRef = useRef<HTMLDivElement>(null);

  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  const [currentPage, setCurrentPage] = useState(() => Number(searchParams.get("page") ?? "1") || 1);
  const [pageSize, setPageSize] = useState(10);

  const { isVisible: tampil, toggle: toggleColumn } = useColumnVisibility("master-produk", KOLOM_TERSEDIA);

  /** Kembali dari halaman Rekap Stok Produk lewat `?expand=<id>` (lihat `linkRekapStokProduk`
   *  di bawah) — baris yang tadi dibuka dibuka lagi otomatis, bukan balik ke daftar tertutup. */
  const [expandedRows, setExpandedRows] = useState<Set<string>>(() => {
    const expandId = searchParams.get("expand");
    return expandId ? new Set([expandId]) : new Set();
  });
  const [actionMenuRowId, setActionMenuRowId] = useState<string | null>(null);
  /** Tombol titik-tiga yang sedang aktif — jadi patokan posisi menu yang di-portal. */
  const [actionMenuAnchor, setActionMenuAnchor] = useState<HTMLElement | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<Produk | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [riwayatTarget, setRiwayatTarget] = useState<Produk | null>(null);
  const [riwayatRows, setRiwayatRows] = useState<RiwayatHargaRow[]>([]);
  const [riwayatLoading, setRiwayatLoading] = useState(false);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (filterMenuRef.current && !filterMenuRef.current.contains(e.target as Node)) setIsFilterMenuOpen(false);
      if (!(e.target as HTMLElement).closest?.("[data-action-menu]")) setActionMenuRowId(null);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const toggleExpandRow = (id: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSort = (colKey: string) => {
    if (sortColumn === colKey) setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortColumn(colKey);
      setSortDirection("asc");
    }
  };

  const filteredRows = useMemo(
    () => saringProduk(rows, { q: search, bisnis: bisnisFilter, status: statusFilter }),
    [rows, search, bisnisFilter, statusFilter],
  );

  /** Kartu ringkasan dihitung dari baris yang LOLOS penyaring, bukan dari seluruh master produk —
   *  kalau tidak, menyaring "Parfum · Nonaktif" menyisakan 3 baris di tabel sementara kartunya
   *  masih memajang angka seluruh perusahaan, dan dua angka yang berdampingan di satu layar itu
   *  pasti dibaca sebagai satu kesatuan. Jumlah seluruhnya tetap ditulis di baris kecil di bawah
   *  angkanya supaya tidak hilang sama sekali. */
  const metrics = useMemo(() => {
    const aktif = filteredRows.filter((r) => r.isActive);
    const berbandingModal = filteredRows.filter((r) => r.costPrice > 0 && r.sellPrice > 0);
    const rataMargin = berbandingModal.length
      ? berbandingModal.reduce((sum, r) => sum + ((r.sellPrice - r.costPrice) / r.sellPrice) * 100, 0) / berbandingModal.length
      : 0;
    return {
      total: filteredRows.length,
      aktif: aktif.length,
      nonaktif: filteredRows.length - aktif.length,
      rataMargin,
      /** Pembanding "dari sekian" — selalu seluruh master produk, tidak ikut disaring. */
      totalSemua: rows.length,
      aktifSemua: rows.filter((r) => r.isActive).length,
      berbandingModalCount: berbandingModal.length,
    };
  }, [rows, filteredRows]);

  const sortedRows = useMemo(() => {
    const list = [...filteredRows];
    list.sort((a, b) => {
      if (!sortColumn) return a.code.localeCompare(b.code);
      let valA: string | number = "";
      let valB: string | number = "";
      if (sortColumn === "code") {
        valA = a.code.toLowerCase();
        valB = b.code.toLowerCase();
      } else if (sortColumn === "name") {
        valA = a.name.toLowerCase();
        valB = b.name.toLowerCase();
      } else if (sortColumn === "totalStok") {
        valA = a.stokTotal;
        valB = b.stokTotal;
      }
      if (valA < valB) return sortDirection === "asc" ? -1 : 1;
      if (valA > valB) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });
    return list;
  }, [filteredRows, sortColumn, sortDirection]);

  const totalItems = sortedRows.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  /** Halaman dari URL bisa saja melebihi jumlah halaman yang tersisa (mis. balik dari edit
   *  setelah produknya dihapus) — dijepit di sini supaya tabelnya tidak tampil kosong melompong. */
  const halamanAktif = Math.min(currentPage, totalPages);
  const nomorHalaman = useMemo(() => getPageWindow(halamanAktif, totalPages), [halamanAktif, totalPages]);
  const startIndex = (halamanAktif - 1) * pageSize;
  const paginatedRows = sortedRows.slice(startIndex, startIndex + pageSize);

  /** Keadaan daftar saat ini (penyaring + halaman), dititipkan ke link tambah/edit sebagai `back`.
   *  Tombol Back browser sebenarnya sudah cukup (URL daftar di-`replaceState` tiap penyaring
   *  berubah), tapi ini menutup jalur yang TIDAK lewat Back: setelah Simpan, form harus
   *  mengembalikan pemakai ke halaman 4 yang tadi dia tinggalkan, bukan ke halaman 1. */
  const kembaliKe = useMemo(() => {
    const params = new URLSearchParams();
    if (search) params.set("q", search);
    if (bisnisFilter) params.set("bisnis", bisnisFilter);
    if (statusFilter) params.set("status", statusFilter);
    if (halamanAktif > 1) params.set("page", String(halamanAktif));
    const qs = params.toString();
    return qs ? `back=${encodeURIComponent(qs)}` : "";
  }, [search, bisnisFilter, statusFilter, halamanAktif]);

  const linkEdit = (id: string) => `/master/produk/${id}/edit${kembaliKe ? `?${kembaliKe}` : ""}`;
  const linkBaru = `/master/produk/baru${kembaliKe ? `?${kembaliKe}` : ""}`;

  useHotkey({ key: "n", ctrl: true, allowInEditable: true }, () => {
    if (canManage) router.push(linkBaru);
  });

  /** Query untuk PDF & Excel — IKUT penyaring yang sedang aktif di layar, supaya berkas yang
   *  terunduh berisi persis apa yang sedang dilihat. Beda dari rekap PO (yang penyaring teksnya
   *  sengaja tidak ikut karena berkasnya disusun dari query periode di server): di sini
   *  penyaringnya satu fungsi yang sama persis (`saringProduk`) di layar maupun di server, jadi
   *  `q` aman ikut serta. */
  const reportQuery = useMemo(() => {
    const params = new URLSearchParams();
    if (search) params.set("q", search);
    if (bisnisFilter) params.set("bisnis", bisnisFilter);
    if (statusFilter) params.set("status", statusFilter);
    const qs = params.toString();
    return qs ? `?${qs}` : "";
  }, [search, bisnisFilter, statusFilter]);

  /** Penyaring yang sedang aktif, ditulis satu per satu sebagai lencana yang bisa dicopot —
   *  bukan cuma angka "2 filter" di tombol. Angka di kartu ringkasan sekarang ikut menyusut
   *  mengikuti penyaring, jadi apa yang sedang menyaring HARUS kelihatan di layar yang sama;
   *  tanpa itu, "12 produk" yang terbaca tidak pernah jelas 12 dari apa. */
  const chipsPenyaring = useMemo(() => {
    const daftar: { key: string; label: string; nilai: string; hapus: () => void }[] = [];
    if (search.trim()) {
      daftar.push({
        key: "q",
        label: "Pencarian",
        nilai: `"${search.trim()}"`,
        hapus: () => {
          setSearch("");
          updateUrlParam("q", "");
          setCurrentPage(1);
          updateUrlParam("page", "");
        },
      });
    }
    if (bisnisFilter) {
      daftar.push({
        key: "bisnis",
        label: "Bisnis",
        nilai: businessTypeName(bisnisFilter),
        hapus: () => {
          setBisnisFilter("");
          updateUrlParam("bisnis", "");
          setCurrentPage(1);
          updateUrlParam("page", "");
        },
      });
    }
    if (statusFilter) {
      daftar.push({
        key: "status",
        label: "Status",
        nilai: statusFilter === "active" ? "Aktif" : "Nonaktif",
        hapus: () => {
          setStatusFilter("");
          updateUrlParam("status", "");
          setCurrentPage(1);
          updateUrlParam("page", "");
        },
      });
    }
    return daftar;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, bisnisFilter, statusFilter, businessTypes]);

  const adaPenyaring = chipsPenyaring.length > 0;

  const bersihkanSemuaPenyaring = () => {
    setSearch("");
    setBisnisFilter("");
    setStatusFilter("");
    setCurrentPage(1);
    for (const key of ["q", "bisnis", "status", "page"]) updateUrlParam(key, "");
  };

  const jumlahPenyaringAktif = (bisnisFilter ? 1 : 0) + (statusFilter ? 1 : 0);
  /** +1 untuk kolom tombol expand yang selalu tampil dan tidak ikut penyaring kolom. */
  const jumlahKolomTampil = KOLOM_TERSEDIA.filter((k) => tampil(k.key)).length + 1;

  const openRiwayat = async (product: Produk) => {
    setRiwayatTarget(product);
    setRiwayatLoading(true);
    try {
      const res = await fetch(`/api/purchase-order/riwayat-harga?productId=${product.id}`);
      const data = await res.json().catch(() => []);
      setRiwayatRows(res.ok ? data : []);
    } finally {
      setRiwayatLoading(false);
    }
  };

  const confirmDelete = async (alasan: string) => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/produk/${deleteTarget.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ alasan }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        // Pesan dari backend dipakai apa adanya — sejak Tahap 20 yang memblokir bukan lagi
        // "dipakai transaksi" melainkan sisa stok, dan pesannya menyebutkan itu.
        toast.error(data?.error || "Gagal menghapus produk");
        return;
      }
      toast.success("Produk dipindahkan ke Arsip");
      setDeleteTarget(null);
      router.refresh();
    } catch {
      toast.error("Gagal menghubungi server");
    } finally {
      setDeleting(false);
    }
  };

  /** Bagian yang dituju dikirim lewat `?tab=`, bukan jangkar `#gudang`: di halaman rekap
   *  ketiganya sekarang tab, dan jangkar tidak bisa membuka tab yang sedang tertutup. */
  const linkStok = (id: string, bagian: "gudang" | "sales" | "toko") => {
    const params = new URLSearchParams(kembaliKe);
    params.set("tab", bagian);
    return `/master/produk/${id}/stok?${params}`;
  };

  /** Tombol "Lihat Rekap Stok Produk" di panel baris terbuka — sama dengan `kembaliKe`, tapi
   *  menitipkan `expand=<id>` supaya baris ini otomatis terbuka lagi saat Back dari halaman
   *  rekap (lihat seed `expandedRows` di atas), bukan cuma kembali ke daftar yang tertutup. */
  const linkRekapStokProduk = (id: string) => {
    const params = new URLSearchParams();
    if (search) params.set("q", search);
    if (bisnisFilter) params.set("bisnis", bisnisFilter);
    if (statusFilter) params.set("status", statusFilter);
    if (halamanAktif > 1) params.set("page", String(halamanAktif));
    params.set("expand", id);
    return `/master/produk/${id}/stok?back=${encodeURIComponent(params.toString())}`;
  };

  const renderStatusBadge = (aktif: boolean) => (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold border ${
        aktif
          ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200/80 dark:border-emerald-500/20"
          : "bg-slate-100 dark:bg-surface-hover text-slate-600 dark:text-fg-muted border-slate-200/80 dark:border-line"
      }`}
    >
      <span className={`w-2 h-2 rounded-full ${aktif ? "bg-emerald-500" : "bg-slate-400"}`} />
      {aktif ? "Aktif" : "Nonaktif"}
    </span>
  );

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-500/10 text-[#0544cc] dark:text-blue-400 flex items-center justify-center flex-shrink-0 border border-blue-100 dark:border-blue-500/20 shadow-2xs">
            <Package className="w-4.5 h-4.5" />
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-fg tracking-tight leading-tight">Produk</h1>
            <p className="text-xs text-slate-500 dark:text-fg-muted font-normal mt-0.5">
              Master produk lintas bisnis — klik kode atau namanya untuk mengubah.
            </p>
          </div>
        </div>

        {canManage && (
          <Link href={linkBaru}>
            <Button variant="primary" size="sm" leftIcon={<Plus className="w-3.5 h-3.5" />}>
              Tambah Produk <span className="ml-1 text-[10px] font-mono opacity-80">(Ctrl+N)</span>
            </Button>
          </Link>
        )}
      </div>

      {/* Keterangan penyaring, sengaja DI ATAS kartu ringkasan — kartunya sekarang menghitung
          baris yang lolos penyaring saja, jadi barisan lencana ini adalah judul yang menjelaskan
          angka-angka di bawahnya, bukan pelengkap di pojok tabel. */}
      {adaPenyaring && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-blue-200/70 dark:border-blue-500/20 bg-blue-50/60 dark:bg-blue-500/5 px-3 py-2">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-[#0544cc] dark:text-blue-400 uppercase tracking-wide">
            <Filter className="w-3.5 h-3.5" />
            Filter aktif
          </span>
          {chipsPenyaring.map((chip) => (
            <span
              key={chip.key}
              className="inline-flex items-center gap-1.5 pl-2.5 pr-1 py-0.5 rounded-full bg-white dark:bg-surface border border-blue-200/80 dark:border-blue-500/20 text-xs font-semibold text-slate-700 dark:text-fg-secondary shadow-2xs"
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
            className="ml-auto text-[11px] font-bold text-[#0544cc] dark:text-blue-400 hover:underline cursor-pointer"
          >
            Hapus semua filter
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="rounded-xl border border-slate-200/80 dark:border-line bg-white/80 dark:bg-surface p-3.5 shadow-2xs flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-900/20 text-[#0544cc] dark:text-blue-400 flex items-center justify-center flex-shrink-0 border border-blue-100 dark:border-blue-900/30">
            <Package className="w-4.5 h-4.5" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 dark:text-fg-muted">Total Produk</p>
            <p className="text-lg sm:text-xl font-bold text-slate-900 dark:text-fg tracking-tight leading-tight mt-0.5">{metrics.total}</p>
            <p className="text-[11px] text-slate-400 dark:text-fg-muted mt-0.5">{adaPenyaring ? `dari ${metrics.totalSemua} produk` : "item terdaftar"}</p>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200/80 dark:border-line bg-white/80 dark:bg-surface p-3.5 shadow-2xs flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center flex-shrink-0 border border-emerald-100 dark:border-emerald-900/30">
            <PackageCheck className="w-4.5 h-4.5" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 dark:text-fg-muted">Produk Aktif</p>
            <p className="text-lg sm:text-xl font-bold text-slate-900 dark:text-fg tracking-tight leading-tight mt-0.5">{metrics.aktif}</p>
            <p className="text-[11px] text-slate-400 dark:text-fg-muted mt-0.5">{adaPenyaring ? `dari ${metrics.aktifSemua} aktif keseluruhan` : "bisa dijual & diorder"}</p>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200/80 dark:border-line bg-white/80 dark:bg-surface p-3.5 shadow-2xs flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-surface-hover text-slate-500 dark:text-fg-muted flex items-center justify-center flex-shrink-0 border border-slate-200 dark:border-line">
            <PackageX className="w-4.5 h-4.5" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 dark:text-fg-muted">Nonaktif</p>
            <p className="text-lg sm:text-xl font-bold text-slate-900 dark:text-fg tracking-tight leading-tight mt-0.5">{metrics.nonaktif}</p>
            <p className="text-[11px] text-slate-400 dark:text-fg-muted mt-0.5">disembunyikan dari transaksi</p>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200/80 dark:border-line bg-white/80 dark:bg-surface p-3.5 shadow-2xs flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 flex items-center justify-center flex-shrink-0 border border-amber-100 dark:border-amber-900/30">
            <Percent className="w-4.5 h-4.5" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 dark:text-fg-muted">Rata-rata Margin</p>
            <p className="text-lg sm:text-xl font-bold text-slate-900 dark:text-fg tracking-tight leading-tight mt-0.5">
              {metrics.rataMargin.toFixed(1)}%
            </p>
            <p className="text-[11px] text-slate-400 dark:text-fg-muted mt-0.5">{metrics.berbandingModalCount} produk punya harga beli</p>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200/80 dark:border-line bg-white dark:bg-surface shadow-2xs p-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-3.5">
          <div className="relative flex items-center w-full sm:max-w-[180px] lg:max-w-[270px] sm:shrink-0">
            <Search className="w-3.5 h-3.5 text-slate-400 dark:text-fg-muted absolute left-3.5 pointer-events-none" />
            <input
              type="text"
              placeholder="Cari kode, nama, varian, ukuran..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                updateUrlParam("q", e.target.value);
                setCurrentPage(1);
                updateUrlParam("page", "");
              }}
              className="w-full h-9 pl-9 pr-3.5 text-xs sm:text-sm font-medium rounded-xl bg-white/90 dark:bg-surface border border-slate-200/90 dark:border-line text-slate-800 dark:text-fg placeholder:text-slate-400 dark:placeholder:text-fg-muted focus:outline-none focus:border-[#0544cc] focus:ring-2 focus:ring-[#0544cc]/10 transition-colors shadow-2xs"
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
                  <span className="min-w-4 h-4 px-1 rounded-full bg-[#0544cc] text-white text-[10px] font-bold flex items-center justify-center">
                    {jumlahPenyaringAktif}
                  </span>
                )}
                <ChevronDown className="w-3 h-3 text-slate-400" />
              </button>
              {isFilterMenuOpen && (
                <div className="absolute right-0 mt-1.5 w-56 rounded-xl border border-slate-200 dark:border-line bg-white dark:bg-surface p-1.5 shadow-xl z-50">
                  <p className="px-3 pt-1 pb-1.5 text-[10px] font-bold text-slate-400 dark:text-fg-muted uppercase tracking-wider">Bisnis</p>
                  {[{ id: "", name: "Semua Bisnis" }, ...businessTypes].map((b) => (
                    <button
                      key={b.id || "all"}
                      type="button"
                      onClick={() => {
                        setBisnisFilter(b.id);
                        updateUrlParam("bisnis", b.id);
                        setCurrentPage(1);
                        updateUrlParam("page", "");
                      }}
                      className={`w-full flex items-center justify-between px-3 py-1.5 text-xs font-semibold rounded-lg text-left cursor-pointer transition-colors ${
                        bisnisFilter === b.id
                          ? "bg-blue-50 text-[#0544cc] dark:bg-blue-900/30 dark:text-blue-300"
                          : "text-slate-700 dark:text-fg-secondary hover:bg-slate-100/70 dark:hover:bg-surface-hover"
                      }`}
                    >
                      <span>{b.name}</span>
                      {bisnisFilter === b.id && <Check className="w-3.5 h-3.5 text-[#0544cc]" />}
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
                          ? "bg-blue-50 text-[#0544cc] dark:bg-blue-900/30 dark:text-blue-300"
                          : "text-slate-700 dark:text-fg-secondary hover:bg-slate-100/70 dark:hover:bg-surface-hover"
                      }`}
                    >
                      <span>{opt.label}</span>
                      {statusFilter === opt.value && <Check className="w-3.5 h-3.5 text-[#0544cc]" />}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <ColumnVisibilityMenu columns={KOLOM_TERSEDIA} isVisible={tampil} onToggle={toggleColumn} />

            {/* PDF buka modal pratinjau dulu (isi + tombol Cetak/Buka Tab Baru sendiri di
                dalamnya — lihat ProdukReportPreviewModal), BUKAN langsung `<a target="_blank">`
                ke berkasnya seperti sebelumnya — pola disamakan dengan Purchase Order &
                Penerimaan Barang. Excel tetap diunduh langsung: lembar sebar memang dibuka di
                aplikasinya sendiri, tidak ada gunanya dipratinjau dulu. */}
            <button
              type="button"
              onClick={() => setShowReportPreview(true)}
              title="Pratinjau & cetak PDF daftar produk sesuai filter di layar"
              className="flex items-center gap-1.5 px-3 h-9 rounded-xl bg-white/90 dark:bg-surface hover:bg-slate-50 dark:hover:bg-surface-hover border border-slate-200/90 dark:border-line shadow-2xs text-xs font-semibold text-slate-700 dark:text-fg-secondary cursor-pointer transition-colors"
            >
              <FileText className="w-3.5 h-3.5 text-slate-400" />
              <span>PDF</span>
            </button>
            <a
              href={`/api/laporan/produk/excel${reportQuery}`}
              title="Unduh Excel daftar produk sesuai filter di layar"
              className="flex items-center gap-1.5 px-3 h-9 rounded-xl bg-white/90 dark:bg-surface hover:bg-slate-50 dark:hover:bg-surface-hover border border-slate-200/90 dark:border-line shadow-2xs text-xs font-semibold text-slate-700 dark:text-fg-secondary cursor-pointer transition-colors"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-slate-400" />
              <span>Excel</span>
            </a>
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-200/70 dark:border-line">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="bg-blue-50/70 dark:bg-surface-hover/80 text-[11px] font-bold text-slate-700 dark:text-fg-secondary border-b border-slate-200/80 dark:border-line">
                <th className="w-10 py-3.5 px-3 text-center" aria-label="Expand" />
                {tampil("photo") && <th className="py-3.5 px-3 text-center w-28">Foto</th>}
                {tampil("code") && (
                  <th className="py-3.5 px-3">
                    <button type="button" onClick={() => handleSort("code")} className="flex items-center gap-1.5 hover:text-[#0544cc] transition-colors cursor-pointer">
                      <span>Kode</span>
                      <ArrowUpDown className="w-3.5 h-3.5 opacity-70" />
                    </button>
                  </th>
                )}
                {tampil("name") && (
                  <th className="py-3.5 px-3">
                    <button type="button" onClick={() => handleSort("name")} className="flex items-center gap-1.5 hover:text-[#0544cc] transition-colors cursor-pointer">
                      <span>Nama Produk</span>
                      <ArrowUpDown className="w-3.5 h-3.5 opacity-70" />
                    </button>
                  </th>
                )}
                {tampil("totalStok") && (
                  <th className="py-3.5 px-3 text-right">
                    <button type="button" onClick={() => handleSort("totalStok")} className="flex items-center gap-1.5 ml-auto hover:text-[#0544cc] transition-colors cursor-pointer">
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
                  return (
                    <React.Fragment key={p.id}>
                      <tr className="hover:bg-blue-50/20 dark:hover:bg-surface-hover/40 transition-colors">
                        <td className="py-3 px-3 text-center">
                          <button
                            type="button"
                            onClick={() => toggleExpandRow(p.id)}
                            className="w-7 h-7 rounded-full bg-blue-50 dark:bg-blue-900/20 text-[#0544cc] dark:text-blue-400 border border-blue-200/80 dark:border-blue-800/40 flex items-center justify-center hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors cursor-pointer"
                            title={isExpanded ? "Tutup Rincian" : "Buka Rincian"}
                          >
                            <ChevronRight className={`w-3.5 h-3.5 transition-transform duration-200 ${isExpanded ? "rotate-90" : ""}`} />
                          </button>
                        </td>
                        {tampil("photo") && (
                          <td className="py-3 px-3">
                            {/* Kotak 1:1 tetap digambar walau fotonya belum ada — kalau petaknya
                                ikut hilang, tinggi baris jadi tidak seragam dan tabelnya terbaca
                                bergoyang saat digulir. */}
                            <div className="relative w-20 aspect-square mx-auto rounded-lg overflow-hidden border border-slate-200/90 dark:border-line bg-slate-50 dark:bg-surface-hover/40 flex items-center justify-center">
                              {p.photoUrl ? (
                                <Image src={p.photoUrl} alt={`Foto ${p.name}`} fill sizes="80px" className="object-cover" unoptimized />
                              ) : (
                                <ImageOff className="w-6 h-6 text-slate-300 dark:text-fg-muted" />
                              )}
                            </div>
                          </td>
                        )}
                        {tampil("code") && (
                          <td className="py-3 px-3 font-mono font-bold">
                            {canManage ? (
                              <Link href={linkEdit(p.id)} className="text-[#0544cc] dark:text-blue-400 hover:underline" title="Ubah produk ini">
                                {p.code}
                              </Link>
                            ) : (
                              <span className="text-slate-700 dark:text-fg-secondary">{p.code}</span>
                            )}
                          </td>
                        )}
                        {tampil("name") && (
                          <td className="py-3 px-3">
                            {canManage ? (
                              <Link href={linkEdit(p.id)} className="font-bold text-slate-800 dark:text-fg hover:text-[#0544cc] dark:hover:text-blue-400 hover:underline" title="Ubah produk ini">
                                {p.name}
                              </Link>
                            ) : (
                              <span className="font-bold text-slate-800 dark:text-fg">{p.name}</span>
                            )}
                            {(p.variant || p.size) && (
                              <p className="text-[11px] text-slate-500 dark:text-fg-muted mt-0.5">{[p.variant, p.size].filter(Boolean).join(" · ")}</p>
                            )}
                          </td>
                        )}
                        {tampil("totalStok") && (
                          <td className="py-3 px-3 text-right">
                            <button
                              type="button"
                              onClick={() => toggleExpandRow(p.id)}
                              className="font-extrabold text-slate-900 dark:text-fg hover:text-[#0544cc] dark:hover:text-blue-400 cursor-pointer transition-colors"
                              title="Lihat rincian per lokasi"
                            >
                              {p.stokTotal.toLocaleString("id-ID")}
                            </button>
                          </td>
                        )}
                        {tampil("status") && <td className="py-3 px-3 text-center">{renderStatusBadge(p.isActive)}</td>}
                        {tampil("action") && (
                          <td className="py-3 px-3 text-center">
                            <div className="flex items-center justify-center">
                              {/* `data-action-menu` WAJIB ada di pembungkus ini — penutup-saat-klik-di-luar
                                  memeriksanya, dan tanpa itu menunya tertutup sebelum isinya sempat diklik.
                                  Panel menunya sendiri di-portal (lihat PortalMenu) dan membawa atribut yang sama. */}
                              <div className="relative" data-action-menu>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const buka = actionMenuRowId !== p.id;
                                    setActionMenuAnchor(buka ? e.currentTarget : null);
                                    setActionMenuRowId(buka ? p.id : null);
                                  }}
                                  className={`w-8 h-8 rounded-lg border border-slate-200/90 dark:border-line flex items-center justify-center text-slate-600 dark:text-fg-muted hover:text-[#0544cc] dark:hover:text-blue-400 shadow-2xs cursor-pointer transition-colors ${
                                    actionMenuRowId === p.id ? "bg-blue-50 text-[#0544cc] border-blue-300" : "bg-white/80 dark:bg-surface hover:bg-slate-50"
                                  }`}
                                  title="Aksi Lainnya"
                                >
                                  <MoreVertical className="w-4 h-4" />
                                </button>

                                {/* Di-portal ke body: pembungkus tabel ber-`overflow-x-auto` memotong
                                    menu yang menempel di dalam baris. */}
                                <PortalMenu
                                  open={actionMenuRowId === p.id}
                                  anchor={actionMenuAnchor}
                                  width={216}
                                  onClose={() => setActionMenuRowId(null)}
                                  className="rounded-xl bg-white dark:bg-surface border border-slate-200/90 dark:border-line shadow-xl py-1.5 text-left"
                                >
                                  {canManage && (
                                    <Link
                                      onClick={() => setActionMenuRowId(null)}
                                      href={linkEdit(p.id)}
                                      className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-fg hover:bg-slate-50 dark:hover:bg-surface-hover transition-colors"
                                    >
                                      <Pencil className="w-3.5 h-3.5 text-[#0544cc]" />
                                      <span>Edit Produk</span>
                                    </Link>
                                  )}

                                  <button
                                    type="button"
                                    onClick={() => {
                                      setActionMenuRowId(null);
                                      openRiwayat(p);
                                    }}
                                    className="w-full flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-fg hover:bg-slate-50 dark:hover:bg-surface-hover transition-colors text-left cursor-pointer"
                                  >
                                    <History className="w-3.5 h-3.5 text-slate-500" />
                                    <span>Riwayat Harga Beli</span>
                                  </button>

                                  {canManage && (
                                    <>
                                      <div className="my-1 border-t border-slate-100 dark:border-line" />
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setActionMenuRowId(null);
                                          setDeleteTarget(p);
                                        }}
                                        className="w-full flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20 transition-colors text-left cursor-pointer"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                        <span>Hapus Produk</span>
                                      </button>
                                    </>
                                  )}
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
                              {/* Isinya SENGAJA cuma rekap stok — varian/ukuran/satuan/harga yang
                                  dulu dipajang di sini sudah kelihatan di kolom tabel atau tinggal
                                  dibuka lewat Edit, jadi mengulangnya cuma bikin baris terbuka jadi
                                  ramai tanpa menjawab pertanyaan apa pun. */}
                              <div className="flex items-center justify-end px-3.5 pt-3 pb-2">
                                <Link
                                  href={linkRekapStokProduk(p.id)}
                                  className="inline-flex items-center gap-1.5 px-3 h-7 rounded-lg bg-white dark:bg-surface hover:bg-blue-50/70 dark:hover:bg-surface-hover border border-slate-200/90 dark:border-line shadow-2xs text-[11px] font-bold text-[#0544cc] dark:text-blue-400 transition-colors"
                                >
                                  <ExternalLink className="w-3 h-3" />
                                  Lihat Rekap Stok Produk
                                </Link>
                              </div>
                              <div className="overflow-x-auto">
                                <table className="w-full text-xs">
                                  <thead className="bg-blue-50/70 dark:bg-surface-hover text-[11px] font-bold text-slate-500 dark:text-fg-muted uppercase">
                                    <tr>
                                      <th className="text-center px-3.5 py-2 w-10">No.</th>
                                      <th className="text-left px-3.5 py-2">Lokasi</th>
                                      <th className="text-right px-3.5 py-2">Saldo Awal</th>
                                      <th className="text-right px-3.5 py-2">Debet</th>
                                      <th className="text-right px-3.5 py-2">Kredit</th>
                                      <th className="text-right px-3.5 py-2">Akhir</th>
                                      <th className="px-3.5 py-2 w-8" aria-label="Rincian" />
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-100 dark:divide-line">
                                    {(
                                      [
                                        ["gudang", "Gudang", p.saldoGudang],
                                        ["sales", "Sales", p.saldoSales],
                                        ["toko", "Toko", p.saldoToko],
                                      ] as [("gudang" | "sales" | "toko"), string, SaldoStok][]
                                    ).map(([bagian, label, saldo], i) => (
                                      <tr key={bagian} className="hover:bg-blue-50/30 dark:hover:bg-surface-hover/40 transition-colors">
                                        <td className="px-3.5 py-2 text-center text-slate-500 dark:text-fg-muted">{i + 1}</td>
                                        <td className="px-3.5 py-2">
                                          <Link href={linkStok(p.id, bagian)} className="font-bold text-[#0544cc] dark:text-blue-400 hover:underline" title={`Rekap stok ${label} untuk ${p.name}`}>
                                            {label}
                                          </Link>
                                        </td>
                                        <td className="px-3.5 py-2 text-right text-slate-600 dark:text-fg-muted">{saldo.saldoAwal.toLocaleString("id-ID")}</td>
                                        <td className="px-3.5 py-2 text-right font-semibold text-emerald-600 dark:text-emerald-400">
                                          {saldo.debet ? `+${saldo.debet.toLocaleString("id-ID")}` : "—"}
                                        </td>
                                        <td className="px-3.5 py-2 text-right font-semibold text-rose-600 dark:text-rose-400">
                                          {saldo.kredit ? `−${saldo.kredit.toLocaleString("id-ID")}` : "—"}
                                        </td>
                                        <td className="px-3.5 py-2 text-right font-extrabold text-slate-900 dark:text-fg">{saldo.saldoAkhir.toLocaleString("id-ID")}</td>
                                        <td className="px-3.5 py-2 text-right">
                                          <Link href={linkStok(p.id, bagian)} className="inline-flex text-slate-400 hover:text-[#0544cc]" aria-label={`Rekap stok ${label}`}>
                                            <ChevronRight className="w-3.5 h-3.5" />
                                          </Link>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                  <tfoot>
                                    <tr className="border-t border-slate-200 dark:border-line font-bold bg-blue-50/70 dark:bg-surface-hover">
                                      <td className="px-3.5 py-2" colSpan={2}>
                                        Total ({p.unit})
                                      </td>
                                      <td className="px-3.5 py-2 text-right">
                                        {(p.saldoGudang.saldoAwal + p.saldoSales.saldoAwal + p.saldoToko.saldoAwal).toLocaleString("id-ID")}
                                      </td>
                                      <td className="px-3.5 py-2 text-right text-emerald-700 dark:text-emerald-400">
                                        +{(p.saldoGudang.debet + p.saldoSales.debet + p.saldoToko.debet).toLocaleString("id-ID")}
                                      </td>
                                      <td className="px-3.5 py-2 text-right text-rose-700 dark:text-rose-400">
                                        −{(p.saldoGudang.kredit + p.saldoSales.kredit + p.saldoToko.kredit).toLocaleString("id-ID")}
                                      </td>
                                      <td className="px-3.5 py-2 text-right font-black text-slate-900 dark:text-fg">{p.stokTotal.toLocaleString("id-ID")}</td>
                                      <td />
                                    </tr>
                                  </tfoot>
                                </table>
                              </div>

                              {periodeStok && (
                                <p className="px-3.5 pt-2 text-[10px] text-slate-400 dark:text-fg-muted">
                                  Debet & Kredit periode {formatDate(periodeStok.from)} – {formatDate(periodeStok.to)} · Saldo Akhir = stok yang ada sekarang ·
                                  klik baris untuk rekap per lokasi
                                </p>
                              )}

                              {/* Kaki berisi tautan Edit/Rekap Stok/Riwayat Harga/Hapus sengaja
                                  DIHAPUS (permintaan Owner) — keempatnya sudah ada di menu
                                  titik-tiga baris itu, dan mengulanginya di sini cuma menambah
                                  barisan tautan di bawah tabel yang justru bikin panel terbaca
                                  ramai. Jangan dikembalikan tanpa permintaan baru. */}
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
                    Tidak ada produk yang cocok dengan filter.
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
                    ? "bg-[#0544cc] text-white shadow-xs"
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

      <Modal isOpen={riwayatTarget !== null} onClose={() => setRiwayatTarget(null)} title={`Riwayat Harga Beli — ${riwayatTarget?.name ?? ""}`}>
        {riwayatLoading && <p className="text-sm text-slate-500 dark:text-fg-muted">Memuat...</p>}
        {!riwayatLoading && riwayatRows.length === 0 && (
          <p className="text-sm text-slate-500 dark:text-fg-muted">Belum pernah ada Purchase Order untuk produk ini.</p>
        )}
        {!riwayatLoading && riwayatRows.length > 0 && (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-300 dark:border-line text-left">
                <th className="py-2">No. PO</th>
                <th className="py-2">Tanggal</th>
                <th className="py-2 text-right">Qty</th>
                <th className="py-2 text-right">Harga</th>
              </tr>
            </thead>
            <tbody>
              {riwayatRows.map((r, i) => (
                <tr key={i} className="border-b border-slate-100 dark:border-line/50">
                  <td className="py-2 font-mono text-xs">{r.poNumber}</td>
                  <td className="py-2">{formatDate(r.date)}</td>
                  <td className="py-2 text-right">{r.qty}</td>
                  <td className="py-2 text-right font-bold">{formatRupiah(r.price)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Modal>

      <HapusDialog
        isOpen={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        entitas="Produk"
        nama={deleteTarget?.name}
        catatan="Produk yang masih punya sisa stok akan ditolak — kosongkan stoknya dulu."
        loading={deleting}
      />

      <ProdukReportPreviewModal isOpen={showReportPreview} onClose={() => setShowReportPreview(false)} query={reportQuery} />
    </div>
  );
}
