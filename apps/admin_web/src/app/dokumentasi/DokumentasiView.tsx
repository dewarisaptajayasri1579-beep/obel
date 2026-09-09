"use client";

import React, { useState, useMemo } from "react";
import {
  Tabs,
  TabList,
  Tab,
  TabPanels,
  TabPanel,
  Card,
  Badge,
  Button,
  Modal,
} from "@/components/ui";
import { StatusBadge } from "@/components/ui/StatusBadge";
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/Table";
import {
  Workflow,
  ShieldCheck,
  FileText,
  Smartphone,
  CheckCircle2,
  AlertTriangle,
  Search,
  Store,
  Warehouse,
  RotateCcw,
  Sparkles,
  Info,
  Layers,
  BarChart3,
  CheckCheck,
  Ban,
  TrendingUp,
  Receipt,
  Scale,
} from "lucide-react";

// ==========================================
// 1. KAMUS DOKUMEN RESMI OBBEL
// ==========================================

interface DokumenResmi {
  prefix: string;
  nama: string;
  modelPrisma: string;
  formatNomor: string;
  kategori: "stok" | "penjualan" | "audit";
  alurSingkat: string;
  diterbitkan: string;
  diterima: string;
  efekGudang: string;
  efekBooth: string;
  efekLedger: string;
  deskripsi: string;
}

const DAFTAR_DOKUMEN: DokumenResmi[] = [
  {
    prefix: "DIST",
    nama: "Surat Jalan Distribusi Awal Gudang → Booth",
    modelPrisma: "StockDistribution",
    formatNomor: "DIST-[TIMESTAMP]-[RANDOM]",
    kategori: "stok",
    alurSingkat: "Gudang Pusat → Booth Gerobak",
    diterbitkan: "Admin Pusat / Tim Logistik Gudang",
    diterima: "Petugas Booth (Kasir Gerobak)",
    efekGudang: "- Stok Gudang (Saat status SENT)",
    efekBooth: "+ Stok Booth (Saat status RECEIVED)",
    efekLedger: "WAREHOUSE_TO_BOOTH",
    deskripsi:
      "Alokasi persediaan awal cup minuman siap jual dari Gudang Pusat ke masing-masing Booth gerobak sebelum jam dinas shift dimulai. Qty gudang berkurang seketika saat SENT dan masuk ke stok gerobak saat Petugas melakukan cek fisik dan konfirmasi RECEIVED.",
  },
  {
    prefix: "RSTK",
    nama: "Permintaan & Pengiriman Restock",
    modelPrisma: "RestockRequest",
    formatNomor: "RSTK-[TIMESTAMP]-[RANDOM]",
    kategori: "stok",
    alurSingkat: "Booth Gerobak → Gudang Pusat",
    diterbitkan: "Petugas Booth (Pengajuan) / Admin (Approval)",
    diterima: "Admin Gudang Pusat & Petugas Booth",
    efekGudang: "- Stok Gudang (Saat disetujui & SENT)",
    efekBooth: "+ Stok Booth (Saat konfirmasi RECEIVED)",
    efekLedger: "RESTOCK",
    deskripsi:
      "Penambahan pasokan darurat di tengah jam operasional saat stok suatu produk menyentuh level Menipis atau Kritis di gerobak. Petugas mengajukan kuantitas, Admin menyetujui, dan kurir gudang mendistribusikan ke lokasi gerobak.",
  },
  {
    prefix: "OBL",
    nama: "Nota Transaksi Penjualan POS",
    modelPrisma: "Sale & SaleItem",
    formatNomor: "OBL-[TIMESTAMP]-[RANDOM]",
    kategori: "penjualan",
    alurSingkat: "Kasir Gerobak → Pelanggan",
    diterbitkan: "Petugas Booth (Aplikasi Kasir Android)",
    diterima: "Pelanggan & Sistem Finansial",
    efekGudang: "Tidak ada efek",
    efekBooth: "- Stok Fisik Cup Terjual",
    efekLedger: "SALE",
    deskripsi:
      "Bukti sah transaksi penjualan minuman per cup. Mencatat snapshot harga jual master produk saat transaksi, kuantitas item, total pembayaran, dan ID sesi shift yang aktif.",
  },
  {
    prefix: "PAY",
    nama: "Entri Pelunasan Pembayaran",
    modelPrisma: "Payment",
    formatNomor: "ID Transaksi Atomik (UUID)",
    kategori: "penjualan",
    alurSingkat: "Pelanggan → Kas / Rekening",
    diterbitkan: "Petugas Booth POS Android",
    diterima: "Laci Kas Fisik / Rekening Perusahaan",
    efekGudang: "Tidak ada efek",
    efekBooth: "+ Kas Booth (CASH) / Ledger Bank (QRIS)",
    efekLedger: "Payment Entry (Tercatat di shift)",
    deskripsi:
      "Pencatatan pelunasan nota penjualan melalui metode tunai fisik (CASH) di laci kas gerobak atau nontunai (QRIS) ke rekening penampung. Wajib lunas seketika sebelum nota dicetak.",
  },
  {
    prefix: "RFD",
    nama: "Nota Retur & Refund Penjualan",
    modelPrisma: "SaleRefund & SaleRefundItem",
    formatNomor: "RFD-[TIMESTAMP]-[RANDOM]",
    kategori: "penjualan",
    alurSingkat: "Pelanggan → Admin / Kasir",
    diterbitkan: "Admin Pusat / Petugas Kasir",
    diterima: "Pelanggan & Finansial",
    efekGudang: "Tidak ada efek",
    efekBooth: "Opsional (+ Stok hanya jika layak jual)",
    efekLedger: "REFUND_NO_STOCK_RETURN / VOID_REVERSAL",
    deskripsi:
      "Pengembalian dana kepada pembeli setelah transaksi berstatus PAID. Dokumen penjualan asli tetap berstatus PAID untuk menjaga bukti histori. Stok fisik gerobak hanya dikembalikan bila produk belum rusak/terkonsumsi (REFUND_WITH_STOCK_RETURN).",
  },
  {
    prefix: "SFT",
    nama: "Sesi Jam Kerja Shift Kasir",
    modelPrisma: "ShiftSession",
    formatNomor: "ID Sesi / Tanggal Kerja",
    kategori: "audit",
    alurSingkat: "Sistem ↔ Petugas Booth",
    diterbitkan: "Sistem Penjadwalan & Petugas Booth",
    diterima: "Admin Pusat & Sistem Audit",
    efekGudang: "Tidak ada efek",
    efekBooth: "Membuka / Mengunci Scope Transaksi",
    efekLedger: "Shift Lifecycle (SCHEDULED → OPEN → CLOSING → CLOSED)",
    deskripsi:
      "Penetapan rentang waktu dinas petugas di gerobak tertentu (Shift 1 / Shift 2). Mengunci transaksi penjualan saat status beralih ke CLOSING dan CLOSED untuk persiapan hitung fisik.",
  },
  {
    prefix: "CNT",
    nama: "Berita Acara Hitung Closing",
    modelPrisma: "ShiftStockCount & Item",
    formatNomor: "Berita Acara Shift Session",
    kategori: "audit",
    alurSingkat: "Kasir Gerobak → Admin & Owner",
    diterbitkan: "Petugas Booth",
    diterima: "Admin Pusat & Owner",
    efekGudang: "Tidak ada efek",
    efekBooth: "Penyesuaian ke Actual Count fisik",
    efekLedger: "ADJUSTMENT (Bila terdapat selisih fisik)",
    deskripsi:
      "Dokumen opname fisik di akhir jam kerja shift. Menghitung selisih antara saldo sistem (Expected) dengan fisik riil di gerobak (Actual). Jika terdapat selisih (discrepancy != 0), petugas wajib memilih ReasonCode resmi.",
  },
  {
    prefix: "RTN",
    nama: "Surat Jalan Retur Sisa Stok",
    modelPrisma: "StockReturn & StockReturnItem",
    formatNomor: "RTN-[TIMESTAMP]-[RANDOM]",
    kategori: "stok",
    alurSingkat: "Booth Gerobak → Gudang Pusat",
    diterbitkan: "Petugas Booth",
    diterima: "Admin Gudang Pusat",
    efekGudang: "+ Stok Gudang (Setelah verifikasi terima)",
    efekBooth: "- Stok Booth menjadi 0 (Gerobak bersih)",
    efekLedger: "RETURN_TO_WAREHOUSE",
    deskripsi:
      "Pengembalian seluruh sisa fisik cup dari gerobak kembali ke Gudang Pusat saat shift berakhir, memastikan gerobak kosong dan bersih saat disimpan. Stok gerobak di-reset menjadi 0 dan stok gudang bertambah.",
  },
  {
    prefix: "OPN",
    nama: "Berita Acara Stok Opname Fisik",
    modelPrisma: "StockOpname & Item",
    formatNomor: "OPN-[TIMESTAMP]-[RANDOM]",
    kategori: "audit",
    alurSingkat: "Auditor / Admin → Manajemen",
    diterbitkan: "Auditor / Admin Gudang",
    diterima: "Manajemen & Owner",
    efekGudang: "+/- Sesuai Delta Opname Fisik",
    efekBooth: "+/- Sesuai Delta Opname Fisik",
    efekLedger: "ADJUSTMENT (Snapshot Fact)",
    deskripsi:
      "Pemeriksaan stok periodik terjadwal atau inspeksi mendadak pada lokasi Gudang Pusat maupun Booth gerobak. Membandingkan saldo sistem dengan fisik riil dan memposting compensating movement.",
  },
  {
    prefix: "MOV",
    nama: "Buku Besar Mutasi Stok (Ledger)",
    modelPrisma: "StockMovement",
    formatNomor: "MOV-[TIMESTAMP]-[RANDOM]",
    kategori: "audit",
    alurSingkat: "Database Engine (Append-Only)",
    diterbitkan: "Database Engine Otomatis",
    diterima: "Seluruh Sistem (Single Source of Truth)",
    efekGudang: "Append-only Transaction Entry",
    efekBooth: "Append-only Transaction Entry",
    efekLedger: "Tabel stock_movements (Immutable)",
    deskripsi:
      "Tabel buku besar immutable yang merekam setiap perpindahan saldo stok (OPENING, WAREHOUSE_TO_BOOTH, SALE, RESTOCK, RETURN_TO_WAREHOUSE, ADJUSTMENT, VOID_REVERSAL). Dilarang keras direct UPDATE atau DELETE.",
  },
  {
    prefix: "ADJ",
    nama: "Penyesuaian Selisih Fisik",
    modelPrisma: "StockMovement (ADJUSTMENT)",
    formatNomor: "ADJ-[TIMESTAMP]-[RANDOM]",
    kategori: "audit",
    alurSingkat: "Sistem / Admin → Audit Trail",
    diterbitkan: "Sistem / Admin Pusat",
    diterima: "Sistem & Auditor",
    efekGudang: "+/- Stok Gudang",
    efekBooth: "+/- Stok Booth",
    efekLedger: "ADJUSTMENT (Movement)",
    deskripsi:
      "Pencatatan penyesuaian saldo inventaris akibat selisih hitung fisik closing kasir, barang rusak (DAMAGED), tumpah (SPILLED), atau hilang, dengan wajib menyertakan kode alasan resmi.",
  },
  {
    prefix: "COR",
    nama: "Berita Acara Koreksi Transaksi P0",
    modelPrisma: "TransactionCorrection",
    formatNomor: "ID Koreksi Atomik (UUID)",
    kategori: "audit",
    alurSingkat: "Admin Pusat → Audit Trail",
    diterbitkan: "Admin Pusat",
    diterima: "Sistem & Auditor",
    efekGudang: "Reversal / Replacement Delta",
    efekBooth: "Reversal / Replacement Delta",
    efekLedger: "VOID_REVERSAL & Re-entry",
    deskripsi:
      "Dokumen audit koreksi data berstatus posted (Void Sale, Revisi Qty, Recount Opname). Menyimpan pointer data original V1, versi pengganti V2, kode alasan, dan snapshot dampak bisnis.",
  },
  {
    prefix: "RECON",
    nama: "Tiket Kasus Anomali Rekonsiliasi",
    modelPrisma: "ReconciliationCase",
    formatNomor: "RECON-[TIMESTAMP]-[RANDOM]",
    kategori: "audit",
    alurSingkat: "Engine Otomatis → Admin & Owner",
    diterbitkan: "Correction Engine Otomatis",
    diterima: "Admin Pusat & Owner",
    efekGudang: "Status: OPEN → RESOLVED / IGNORED",
    efekBooth: "Status: OPEN → RESOLVED / IGNORED",
    efekLedger: "RECONCILIATION_REQUIRED",
    deskripsi:
      "Tiket anomali otomatis yang diterbitkan ketika simulasi koreksi historis berpotensi mengakibatkan stok negatif atau inkonsistensi rantai pasok yang memerlukan investigasi manual.",
  },
];

// ==========================================
// 2. SIMULATOR KOREKSI DATA (PRINSIP P0)
// ==========================================

interface SkenarioKoreksi {
  id: string;
  judul: string;
  kategori: string;
  deskripsiMasalah: string;
  versiAwal: {
    dokumen: string;
    detail: string;
    stokTerdampak: string;
    finansial: string;
  };
  reversalAction: {
    tipe: string;
    efek: string;
    ledger: string;
  };
  versiPengganti: {
    dokumen: string;
    detail: string;
    ledger: string;
  };
  dampakOtomatis: {
    omzetNet: string;
    stokAkhir: string;
    closingDiscrepancy: string;
    reconciliationStatus: string;
  };
}

const SKENARIO_KOREKSI: SkenarioKoreksi[] = [
  {
    id: "sale_wrong_qty",
    judul: "Koreksi Salah Qty Penjualan Pasca-Closing",
    kategori: "Penjualan (Sale Correction)",
    deskripsiMasalah:
      "Kasir salah mencatat penjualan 2 cup Matcha (Rp 20.000). Faktanya pembeli hanya membeli 1 cup (Rp 10.000). Shift sudah berstatus CLOSED dan sisa stok sudah diretur ke Gudang.",
    versiAwal: {
      dokumen: "OBL-20260908-0012 (V1)",
      detail: "Matcha x 2 Cup @ Rp 10.000 = Rp 20.000 (PAID Tunai)",
      stokTerdampak: "Stok Booth berkurang 2 cup",
      finansial: "Omzet tercatat Rp 20.000",
    },
    reversalAction: {
      tipe: "REVERSAL ATOMIK V1",
      efek: "Membatalkan seluruh efek V1 (Uang -Rp 20.000, Stok Booth +2 Cup)",
      ledger: "VOID_REVERSAL (Ref: OBL-...-0012 V1)",
    },
    versiPengganti: {
      dokumen: "OBL-20260908-0012 (V2 - Effective)",
      detail: "Matcha x 1 Cup @ Rp 10.000 = Rp 10.000 (PAID Tunai)",
      ledger: "SALE (Ref: OBL-...-0012 V2)",
    },
    dampakOtomatis: {
      omzetNet: "Omzet harian terkoreksi otomatis turun -Rp 10.000",
      stokAkhir: "Stok efektif Booth bertambah +1 cup Matcha",
      closingDiscrepancy:
        "Expected stock closing dihitung ulang secara otomatis tanpa mengubah catatan hitung fisik riil",
      reconciliationStatus:
        "RESOLVED — Snapshot stok terproyeksi sinkron dengan mutasi ledger",
    },
  },
  {
    id: "closing_wrong_count",
    judul: "Koreksi Salah Input Hitung Fisik Closing (Recount)",
    kategori: "Audit Shift (Closing Recount)",
    deskripsiMasalah:
      "Petugas salah memasukkan hitung fisik sisa Brown Sugar menjadi 8 cup (tercatat selisih -2 cup dari expected 10). Setelah dicek ulang di Gudang, fisik riil adalah 9 cup.",
    versiAwal: {
      dokumen: "CNT-20260908-0004 (V1)",
      detail:
        "Expected: 10 Cup, Actual Fisik: 8 Cup, Discrepancy: -2 Cup (Hilang)",
      stokTerdampak:
        "Stok gerobak di-adjust -2 cup ke 8 cup untuk persiapan retur",
      finansial: "Estimasi kerugian selisih Rp 20.000",
    },
    reversalAction: {
      tipe: "RECOUNT VERSIONING (Bukan Edit Row)",
      efek: "CNT V1 tetap diarsipkan sebagai bukti audit. Sistem menerbitkan CNT V2",
      ledger: "SUPERSEDED_BY_REVISION",
    },
    versiPengganti: {
      dokumen: "CNT-20260908-0004 (V2 - Recount)",
      detail: "Expected: 10 Cup, Actual Fisik: 9 Cup, Discrepancy: -1 Cup",
      ledger: "Compensating ADJUSTMENT (+1 Cup)",
    },
    dampakOtomatis: {
      omzetNet: "Tidak ada perubahan pada omzet penjualan",
      stokAkhir: "Stok fisik valid terkoreksi menjadi 9 cup",
      closingDiscrepancy:
        "Selisih barang hilang berkurang dari -2 cup menjadi -1 cup",
      reconciliationStatus:
        "RESOLVED — Surat retur RTN yang terkait otomatis menyesuaikan kuantitas terima fisik",
    },
  },
  {
    id: "distribution_discrepancy",
    judul: "Koreksi Selisih Fisik Penerimaan Distribusi Awal",
    kategori: "Distribusi (Shipment Correction)",
    deskripsiMasalah:
      "Surat jalan DIST mencatat 15 cup Kopsu Pandan dikirim dari Gudang. Saat dicek fisik oleh Petugas Booth sebelum buka shift, barang yang tiba hanya 14 cup (1 cup bocor di jalan).",
    versiAwal: {
      dokumen: "DIST-20260908-0001 (SENT)",
      detail: "Gudang kirim 15 Cup Kopsu Pandan. Status In-Transit: 15 Cup",
      stokTerdampak: "Gudang on-hand -15 cup",
      finansial: "Aset barang keluar Gudang Rp 150.000",
    },
    reversalAction: {
      tipe: "DISCREPANCY RECORDING",
      efek: "Petugas menekan 'Laporkan Selisih', input fisik riil 14 cup",
      ledger: "RECEIVE DRAFT CORRECTION",
    },
    versiPengganti: {
      dokumen: "DIST-20260908-0001 (RECEIVED with DISCREPANCY)",
      detail:
        "Qty Dikirim: 15 Cup, Qty Diterima: 14 Cup, Selisih Transit: -1 Cup",
      ledger: "WAREHOUSE_TO_BOOTH (14 Cup) + DISCREPANCY_LOG (1 Cup)",
    },
    dampakOtomatis: {
      omzetNet: "Tidak berdampak ke omzet penjualan",
      stokAkhir: "Stok Booth aktif bertambah 14 cup (bukan 15)",
      closingDiscrepancy:
        "Expected stock booth dihitung dari 14 cup, mencegah tuduhan selisih palsu di akhir shift",
      reconciliationStatus:
        "RESOLVED — Tiket audit transit mencatat 1 cup rusak dengan kode DAMAGED/SPILLED",
    },
  },
];

// ==========================================
// 3. MATRIKS PERAN & AKSES (RBAC)
// ==========================================

interface RbacItem {
  fitur: string;
  boothStaff: boolean;
  admin: boolean;
  owner: boolean;
  keterangan: string;
}

const RBAC_MATRIX: RbacItem[] = [
  {
    fitur: "Buka Shift & Transaksi Kasir POS",
    boothStaff: true,
    admin: true,
    owner: false,
    keterangan:
      "Staff hanya dapat bertransaksi pada booth dan shift aktif miliknya",
  },
  {
    fitur: "Konfirmasi Terima Distribusi Awal",
    boothStaff: true,
    admin: true,
    owner: false,
    keterangan: "Cek fisik barang masuk gerobak sebelum jam dinas dimulai",
  },
  {
    fitur: "Ajukan Permintaan Restock Lapangan",
    boothStaff: true,
    admin: true,
    owner: false,
    keterangan:
      "Dipicu saat stok cup di gerobak menyentuh level Menipis/Kritis",
  },
  {
    fitur: "Approve & Kirim Restock dari Gudang",
    boothStaff: false,
    admin: true,
    owner: false,
    keterangan: "Hanya Admin yang berhak memotong stok Gudang Pusat",
  },
  {
    fitur: "Input Hitung Fisik Closing Shift",
    boothStaff: true,
    admin: true,
    owner: false,
    keterangan:
      "Hitung fisik actual cup sisa dan catat alasan jika ada selisih",
  },
  {
    fitur: "Kirim Retur Sisa Stok ke Gudang",
    boothStaff: true,
    admin: false,
    owner: false,
    keterangan: "Staff gerobak mengajukan pengembalian sisa stok fisik",
  },
  {
    fitur: "Verifikasi & Terima Retur di Gudang",
    boothStaff: false,
    admin: true,
    owner: false,
    keterangan: "Admin gudang memverifikasi fisik dan menambah stok gudang",
  },
  {
    fitur: "Stock Opname Fisik (Gudang / Booth)",
    boothStaff: false,
    admin: true,
    owner: false,
    keterangan: "Inspeksi stok komparatif sistem vs fisik terjadwal/mendadak",
  },
  {
    fitur: "Void Transaksi Penjualan Posted",
    boothStaff: false,
    admin: true,
    owner: false,
    keterangan:
      "Staff kasir dilarang void. Wajib melalui Admin dengan reason code",
  },
  {
    fitur: "Koreksi Riwayat Data (Prinsip P0)",
    boothStaff: false,
    admin: true,
    owner: false,
    keterangan: "Melalui engine Reversal V1 + Replacement V2 otomatis",
  },
  {
    fitur: "Kelola Master Data (Produk, Booth, Shift)",
    boothStaff: false,
    admin: true,
    owner: false,
    keterangan: "Pengaturan harga jual cup, lokasi gerobak, dan jadwal shift",
  },
  {
    fitur: "Dashboard Eksekutif & Laporan Omzet",
    boothStaff: false,
    admin: true,
    owner: true,
    keterangan:
      "Owner memiliki akses monitoring 100% read-only tanpa hak mutasi",
  },
];

// ==========================================
// 4. MAIN COMPONENT
// ==========================================

export const DokumentasiView: React.FC = () => {
  const [activeTab, setActiveTab] = useState("bisnis");
  const [journeyView, setJourneyView] = useState<
    "cycle" | "threshold" | "doors"
  >("cycle");
  const [selectedKategoriDoc, setSelectedKategoriDoc] =
    useState<string>("semua");
  const [searchDoc, setSearchDoc] = useState("");
  const [selectedDocDetail, setSelectedDocDetail] =
    useState<DokumenResmi | null>(null);
  const [activeSkenario, setActiveSkenario] = useState("sale_wrong_qty");

  // Filter Kamus Dokumen
  const filteredDokumen = useMemo(() => {
    return DAFTAR_DOKUMEN.filter((doc) => {
      const matchKategori =
        selectedKategoriDoc === "semua" || doc.kategori === selectedKategoriDoc;
      const q = searchDoc.toLowerCase().trim();
      const matchSearch =
        !q ||
        doc.prefix.toLowerCase().includes(q) ||
        doc.nama.toLowerCase().includes(q) ||
        doc.modelPrisma.toLowerCase().includes(q) ||
        doc.formatNomor.toLowerCase().includes(q) ||
        doc.alurSingkat.toLowerCase().includes(q) ||
        doc.deskripsi.toLowerCase().includes(q);
      return matchKategori && matchSearch;
    });
  }, [selectedKategoriDoc, searchDoc]);

  const selectedSkenarioData = useMemo(() => {
    return (
      SKENARIO_KOREKSI.find((s) => s.id === activeSkenario) ||
      SKENARIO_KOREKSI[0]
    );
  }, [activeSkenario]);

  return (
    <div className="space-y-6">
      {/* ============================================================== */}
      {/* HEADER SECTION (CLEAN & MATCHING OTHER PAGES) */}
      {/* ============================================================== */}
      <div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-fg">
          Dokumentasi Sistem
        </h1>
        <p className="text-sm text-slate-500 dark:text-fg-muted">
          Panduan arsitektur rantai pasok gerobak, kamus dokumen resmi, dan
          standar konsistensi data P0.
        </p>
      </div>

      {/* ============================================================== */}
      {/* TAB NAVIGATION CONTAINER */}
      {/* ============================================================== */}
      <Card variant="solid" padding="md" className="space-y-4">
        <Tabs value={activeTab} onChange={setActiveTab}>
          <TabList className="pb-1">
            <Tab value="bisnis">
              <div className="flex items-center gap-2">
                <Workflow className="w-4 h-4" />
                <span>Peta Alur Bisnis</span>
              </div>
            </Tab>
            <Tab value="arsitektur">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4" />
                <span>Arsitektur &amp; Peran</span>
              </div>
            </Tab>
            <Tab value="dokumen">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4" />
                <span>Kamus Dokumen</span>
              </div>
            </Tab>
            <Tab value="konsistensi">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4" />
                <span>Konsistensi Data P0</span>
              </div>
            </Tab>
            <Tab value="mobile">
              <div className="flex items-center gap-2">
                <Smartphone className="w-4 h-4" />
                <span>Panduan Operasional</span>
              </div>
            </Tab>
          </TabList>

          <TabPanels>
            {/* ============================================================== */}
            {/* TAB 1: PETA ALUR BISNIS & SIKLUS GEROBAK */}
            {/* ============================================================== */}
            <TabPanel value="bisnis" className="space-y-5 pt-1">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200/80 dark:border-line pb-3">
                <div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-fg">
                    Siklus Rantai Pasok Gerobak Obbel Coffee &amp; Milk
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-fg-muted mt-0.5">
                    Alur perpindahan barang dan uang dari Gudang Pusat hingga
                    tutup shift di gerobak.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant={journeyView === "cycle" ? "primary" : "secondary"}
                    size="sm"
                    onClick={() => setJourneyView("cycle")}
                  >
                    6 Langkah Siklus
                  </Button>
                  <Button
                    variant={
                      journeyView === "threshold" ? "primary" : "secondary"
                    }
                    size="sm"
                    onClick={() => setJourneyView("threshold")}
                  >
                    Level Stok &amp; Restock
                  </Button>
                  <Button
                    variant={journeyView === "doors" ? "primary" : "secondary"}
                    size="sm"
                    onClick={() => setJourneyView("doors")}
                  >
                    SOP Closing &amp; Retur
                  </Button>
                </div>
              </div>

              {/* VIEW 1: 6 LANGKAH SIKLUS GEROBAK */}
              {journeyView === "cycle" && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                  <div className="p-4 rounded-xl bg-slate-50/60 dark:bg-surface border border-slate-200/80 dark:border-line space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="w-6 h-6 rounded-md bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-fg font-bold text-xs flex items-center justify-center">
                        1
                      </span>
                      <StatusBadge
                        type="inactive"
                        label="Pagi Hari"
                        size="sm"
                      />
                    </div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-fg">
                      Distribusi Awal Gudang (DIST)
                    </h3>
                    <p className="text-xs text-slate-600 dark:text-fg-muted leading-relaxed">
                      Admin Pusat menyiapkan dan mengirim kuantitas cup produk
                      dari Gudang ke masing-masing gerobak. Stok gudang otomatis
                      di-deduct dan status menjadi <strong>SENT</strong>.
                    </p>
                    <div className="pt-2 border-t border-slate-200/80 dark:border-line text-[11px] text-slate-500">
                      Dokumen:{" "}
                      <span className="font-mono font-bold text-slate-700 dark:text-fg">
                        DIST
                      </span>{" "}
                      &bull; Ledger:{" "}
                      <code className="font-mono text-slate-600 dark:text-fg-muted">
                        WAREHOUSE_TO_BOOTH
                      </code>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-50/60 dark:bg-surface border border-slate-200/80 dark:border-line space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="w-6 h-6 rounded-md bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-fg font-bold text-xs flex items-center justify-center">
                        2
                      </span>
                      <StatusBadge type="safe" label="Buka Shift" size="sm" />
                    </div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-fg">
                      Cek Fisik &amp; Buka Shift (SFT)
                    </h3>
                    <p className="text-xs text-slate-600 dark:text-fg-muted leading-relaxed">
                      Petugas Booth login di tablet/HP Android, memeriksa
                      kesesuaian fisik cup di gerobak, lalu klik{" "}
                      <strong>Terima</strong>. Status shift menjadi{" "}
                      <strong>OPEN</strong> dan siap melayani penjualan.
                    </p>
                    <div className="pt-2 border-t border-slate-200/80 dark:border-line text-[11px] text-slate-500">
                      Dokumen:{" "}
                      <span className="font-mono font-bold text-slate-700 dark:text-fg">
                        SFT
                      </span>{" "}
                      &bull; Status:{" "}
                      <span className="font-semibold text-emerald-600">
                        OPEN
                      </span>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-50/60 dark:bg-surface border border-slate-200/80 dark:border-line space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="w-6 h-6 rounded-md bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-fg font-bold text-xs flex items-center justify-center">
                        3
                      </span>
                      <StatusBadge
                        type="posted"
                        label="Pelayanan POS"
                        size="sm"
                      />
                    </div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-fg">
                      Penjualan Cepat 2–4 Tap (OBL)
                    </h3>
                    <p className="text-xs text-slate-600 dark:text-fg-muted leading-relaxed">
                      Petugas tap produk, pilih metode bayar{" "}
                      <strong>Tunai</strong> atau <strong>QRIS</strong>, lalu
                      cetak struk thermal. Backend memeriksa stok &ge; qty
                      secara atomik dan mengurangi stok booth.
                    </p>
                    <div className="pt-2 border-t border-slate-200/80 dark:border-line text-[11px] text-slate-500">
                      Dokumen:{" "}
                      <span className="font-mono font-bold text-slate-700 dark:text-fg">
                        OBL / PAY
                      </span>{" "}
                      &bull; Ledger:{" "}
                      <code className="font-mono text-slate-600 dark:text-fg-muted">
                        SALE
                      </code>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-50/60 dark:bg-surface border border-slate-200/80 dark:border-line space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="w-6 h-6 rounded-md bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-fg font-bold text-xs flex items-center justify-center">
                        4
                      </span>
                      <StatusBadge
                        type="expiring_this_month"
                        label="Tengah Hari"
                        size="sm"
                      />
                    </div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-fg">
                      Early Warning &amp; Restock (RSTK)
                    </h3>
                    <p className="text-xs text-slate-600 dark:text-fg-muted leading-relaxed">
                      Saat cup menyentuh batas minimum, kartu beranda menyala
                      kuning/merah. Petugas tap <strong>Minta Restock</strong>,
                      Admin menyetujui, dan kurir gudang mengirim tambahan cup
                      ke gerobak.
                    </p>
                    <div className="pt-2 border-t border-slate-200/80 dark:border-line text-[11px] text-slate-500">
                      Dokumen:{" "}
                      <span className="font-mono font-bold text-slate-700 dark:text-fg">
                        RSTK
                      </span>{" "}
                      &bull; Ledger:{" "}
                      <code className="font-mono text-slate-600 dark:text-fg-muted">
                        RESTOCK
                      </code>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-50/60 dark:bg-surface border border-slate-200/80 dark:border-line space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="w-6 h-6 rounded-md bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-fg font-bold text-xs flex items-center justify-center">
                        5
                      </span>
                      <StatusBadge
                        type="inactive"
                        label="Sore Hari"
                        size="sm"
                      />
                    </div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-fg">
                      Tutup Shift &amp; Hitung Fisik (CNT)
                    </h3>
                    <p className="text-xs text-slate-600 dark:text-fg-muted leading-relaxed">
                      Petugas klik Tutup Shift. Sistem mengunci penjualan baru,
                      menampilkan Expected Stock, dan Petugas menginput Actual
                      Stock fisik. Bila ada selisih (discrepancy), alasan wajib
                      dipilih.
                    </p>
                    <div className="pt-2 border-t border-slate-200/80 dark:border-line text-[11px] text-slate-500">
                      Dokumen:{" "}
                      <span className="font-mono font-bold text-slate-700 dark:text-fg">
                        CNT
                      </span>{" "}
                      &bull; Selisih = Actual - Expected
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-50/60 dark:bg-surface border border-slate-200/80 dark:border-line space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="w-6 h-6 rounded-md bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-fg font-bold text-xs flex items-center justify-center">
                        6
                      </span>
                      <StatusBadge
                        type="expired"
                        label="Malam Hari"
                        size="sm"
                      />
                    </div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-fg">
                      Retur Sisa Stok ke Gudang (RTN)
                    </h3>
                    <p className="text-xs text-slate-600 dark:text-fg-muted leading-relaxed">
                      Seluruh sisa fisik cup di gerobak diserahkan kembali ke
                      Gudang Pusat. Admin memverifikasi fisik, stok gerobak
                      kembali 0, stok gudang bertambah, dan shift resmi{" "}
                      <strong>CLOSED</strong>.
                    </p>
                    <div className="pt-2 border-t border-slate-200/80 dark:border-line text-[11px] text-slate-500">
                      Dokumen:{" "}
                      <span className="font-mono font-bold text-slate-700 dark:text-fg">
                        RTN
                      </span>{" "}
                      &bull; Ledger:{" "}
                      <code className="font-mono text-slate-600 dark:text-fg-muted">
                        RETURN_TO_WAREHOUSE
                      </code>
                    </div>
                  </div>
                </div>
              )}

              {/* VIEW 2: THRESHOLD LEVEL STOK & RESTOCK */}
              {journeyView === "threshold" && (
                <div className="space-y-4">
                  <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-surface border border-slate-200/80 dark:border-line flex items-center gap-2.5 text-xs text-slate-600 dark:text-fg-muted">
                    <Info className="w-4 h-4 text-blue-600 shrink-0" />
                    <span>
                      Sistem Obbel mengklasifikasikan 4 level stok otomatis
                      untuk memicu respon restock cepat:
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    <div className="p-3.5 rounded-xl bg-white dark:bg-surface border border-slate-200 dark:border-line space-y-1.5">
                      <StatusBadge type="safe" label="AMAN" size="sm" />
                      <div className="text-[11px] font-mono text-slate-500">
                        Qty &gt; Min Qty
                      </div>
                      <div className="text-xs font-bold text-slate-900 dark:text-fg">
                        Stok Cukup
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-fg-muted">
                        Ketersediaan cup di atas batas aman. Transaksi normal
                        tanpa peringatan.
                      </p>
                    </div>

                    <div className="p-3.5 rounded-xl bg-white dark:bg-surface border border-slate-200 dark:border-line space-y-1.5">
                      <StatusBadge
                        type="expiring_this_month"
                        label="MENIPIS"
                        size="sm"
                      />
                      <div className="text-[11px] font-mono text-slate-500">
                        Critical &lt; Qty &le; Min
                      </div>
                      <div className="text-xs font-bold text-slate-900 dark:text-fg">
                        Peringatan Awal
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-fg-muted">
                        Kartu produk di POS berubah oranye. Petugas dapat
                        mengajukan restock.
                      </p>
                    </div>

                    <div className="p-3.5 rounded-xl bg-white dark:bg-surface border border-slate-200 dark:border-line space-y-1.5">
                      <StatusBadge type="expired" label="KRITIS" size="sm" />
                      <div className="text-[11px] font-mono text-slate-500">
                        0 &lt; Qty &le; Critical
                      </div>
                      <div className="text-xs font-bold text-slate-900 dark:text-fg">
                        Prioritas Restock
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-fg-muted">
                        Masuk daftar prioritas utama di dashboard admin pusat.
                      </p>
                    </div>

                    <div className="p-3.5 rounded-xl bg-white dark:bg-surface border border-slate-200 dark:border-line space-y-1.5">
                      <StatusBadge type="inactive" label="HABIS" size="sm" />
                      <div className="text-[11px] font-mono text-slate-500">
                        Qty &le; 0 Cup
                      </div>
                      <div className="text-xs font-bold text-slate-900 dark:text-fg">
                        Penjualan Diblokir
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-fg-muted">
                        Sistem backend memblokir penjualan produk ini untuk
                        mencegah minus.
                      </p>
                    </div>
                  </div>

                  <div className="text-[11px] text-slate-500 dark:text-fg-muted bg-slate-50/70 dark:bg-surface/50 border border-slate-200/60 dark:border-line rounded-lg p-2.5">
                    <strong>Konfigurasi Ambang Batas:</strong> Mengacu pada
                    model{" "}
                    <code className="font-mono text-slate-700 dark:text-fg">
                      BoothStockThreshold
                    </code>
                    , ambang batas default sistem adalah{" "}
                    <strong>Minimum: 25 cup</strong> dan{" "}
                    <strong>Kritis: 10 cup</strong>. Admin dapat mengubah batas
                    ini secara granular per produk dan per gerobak di menu
                    Master Ambang Stok.
                  </div>
                </div>
              )}

              {/* VIEW 3: SOP CLOSING & RETUR SISA */}
              {journeyView === "doors" && (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="p-4 rounded-xl bg-white dark:bg-surface border border-slate-200/80 dark:border-line space-y-2">
                      <span className="text-[11px] font-bold text-slate-500 uppercase">
                        Tahap 1: Lock Kasir
                      </span>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-fg">
                        Kunci Transaksi
                      </h4>
                      <p className="text-xs text-slate-600 dark:text-fg-muted leading-relaxed">
                        Begitu status berpindah ke CLOSING, kasir tidak bisa
                        menjual lagi. Saldo uang tunai dihitung dan disiapkan
                        untuk disetor.
                      </p>
                    </div>

                    <div className="p-4 rounded-xl bg-white dark:bg-surface border border-slate-200/80 dark:border-line space-y-2">
                      <span className="text-[11px] font-bold text-slate-500 uppercase">
                        Tahap 2: Opname Fisik
                      </span>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-fg">
                        Hitung Fisik Cup
                      </h4>
                      <p className="text-xs text-slate-600 dark:text-fg-muted leading-relaxed">
                        Petugas menghitung sisa cup per produk. Discrepancy =
                        Actual - Expected. Jika selisih, wajib memilih alasan
                        resmi.
                      </p>
                    </div>

                    <div className="p-4 rounded-xl bg-white dark:bg-surface border border-slate-200/80 dark:border-line space-y-2">
                      <span className="text-[11px] font-bold text-slate-500 uppercase">
                        Tahap 3: Retur Gudang
                      </span>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-fg">
                        Kembalikan ke Gudang
                      </h4>
                      <p className="text-xs text-slate-600 dark:text-fg-muted leading-relaxed">
                        Sisa cup fisik dibawa kembali ke Gudang Pusat. Begitu
                        Admin Gudang klik Terima, stok gerobak menjadi 0 dan
                        shift CLOSED.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </TabPanel>

            {/* ============================================================== */}
            {/* TAB 2: ARSITEKTUR & PERAN */}
            {/* ============================================================== */}
            <TabPanel value="arsitektur" className="space-y-5 pt-1">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-fg">
                  Topologi Arsitektur 3 Aplikasi &amp; Hak Akses (RBAC)
                </h2>
                <p className="text-xs text-slate-500 dark:text-fg-muted mt-0.5">
                  Pembagian peran terpisah dan isolasi otorisasi demi menjaga
                  integritas data operasional.
                </p>
              </div>

              {/* 3 Aplikasi Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                <div className="p-4 rounded-xl bg-white dark:bg-surface border border-slate-200/80 dark:border-line space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Store className="w-4 h-4 text-slate-700 dark:text-fg" />
                      <h3 className="text-sm font-bold text-slate-900 dark:text-fg">
                        Petugas Booth (POS)
                      </h3>
                    </div>
                    <Badge variant="secondary">Flutter</Badge>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-fg-muted leading-relaxed">
                    Aplikasi kasir gerobak keliling. Cepat (2–4 tap checkout),
                    toleran kondisi offline via SQLite, dan terhubung ke thermal
                    printer Bluetooth.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-white dark:bg-surface border border-slate-200/80 dark:border-line space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Warehouse className="w-4 h-4 text-slate-700 dark:text-fg" />
                      <h3 className="text-sm font-bold text-slate-900 dark:text-fg">
                        Admin Pusat &amp; Gudang
                      </h3>
                    </div>
                    <Badge variant="secondary">Next.js PWA</Badge>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-fg-muted leading-relaxed">
                    Pusat kendali operasional web. Distribusi harian,
                    persetujuan restock, verifikasi retur fisik, opname, koreksi
                    transaksi, dan master data.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-white dark:bg-surface border border-slate-200/80 dark:border-line space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <BarChart3 className="w-4 h-4 text-slate-700 dark:text-fg" />
                      <h3 className="text-sm font-bold text-slate-900 dark:text-fg">
                        Owner Dashboard
                      </h3>
                    </div>
                    <Badge variant="secondary">Read-Only</Badge>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-fg-muted leading-relaxed">
                    Panel eksekutif untuk memantau omzet harian bersih, total
                    cup terjual, ranking booth, dan indikator selisih tanpa izin
                    mutasi data.
                  </p>
                </div>
              </div>

              {/* Tabel RBAC Matrix menggunakan TableContainer standar */}
              <div className="space-y-2 pt-1">
                <h3 className="text-sm font-bold text-slate-900 dark:text-fg">
                  Matriks Perizinan Fitur (Role-Based Access Control)
                </h3>
                <TableContainer>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Fitur / Tindakan Bisnis</TableHead>
                        <TableHead className="text-center">
                          <div>Booth Staff</div>
                          <div className="text-[10px] font-mono text-slate-400 font-normal">
                            BOOTH_STAFF
                          </div>
                        </TableHead>
                        <TableHead className="text-center">
                          <div>Admin Pusat</div>
                          <div className="text-[10px] font-mono text-slate-400 font-normal">
                            ADMIN
                          </div>
                        </TableHead>
                        <TableHead className="text-center">
                          <div>Owner</div>
                          <div className="text-[10px] font-mono text-slate-400 font-normal">
                            OWNER
                          </div>
                        </TableHead>
                        <TableHead>Keterangan Otorisasi</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {RBAC_MATRIX.map((r, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="font-semibold text-slate-900 dark:text-fg">
                            {r.fitur}
                          </TableCell>
                          <TableCell className="text-center">
                            {r.boothStaff ? (
                              <CheckCircle2 className="w-4 h-4 text-emerald-600 mx-auto" />
                            ) : (
                              <Ban className="w-4 h-4 text-slate-300 dark:text-slate-600 mx-auto" />
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            {r.admin ? (
                              <CheckCircle2 className="w-4 h-4 text-emerald-600 mx-auto" />
                            ) : (
                              <Ban className="w-4 h-4 text-slate-300 dark:text-slate-600 mx-auto" />
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            {r.owner ? (
                              <CheckCircle2 className="w-4 h-4 text-emerald-600 mx-auto" />
                            ) : (
                              <Ban className="w-4 h-4 text-slate-300 dark:text-slate-600 mx-auto" />
                            )}
                          </TableCell>
                          <TableCell className="text-slate-500 dark:text-fg-muted text-xs">
                            {r.keterangan}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </div>
            </TabPanel>

            {/* ============================================================== */}
            {/* TAB 3: KAMUS DOKUMEN */}
            {/* ============================================================== */}
            <TabPanel value="dokumen" className="space-y-4 pt-1">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200/80 dark:border-line pb-3">
                <div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-fg">
                    Kamus Dokumen
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-fg-muted mt-0.5">
                    Standar kode prefix, surat resmi, dan alur transaksi
                    operasional rantai pasok gerobak.
                  </p>
                </div>

                {/* Filter Kategori */}
                <div className="flex flex-wrap gap-1">
                  <Button
                    variant={
                      selectedKategoriDoc === "semua" ? "primary" : "secondary"
                    }
                    size="sm"
                    onClick={() => setSelectedKategoriDoc("semua")}
                  >
                    Semua
                  </Button>
                  <Button
                    variant={
                      selectedKategoriDoc === "stok" ? "primary" : "secondary"
                    }
                    size="sm"
                    onClick={() => setSelectedKategoriDoc("stok")}
                  >
                    Stok
                  </Button>
                  <Button
                    variant={
                      selectedKategoriDoc === "penjualan"
                        ? "primary"
                        : "secondary"
                    }
                    size="sm"
                    onClick={() => setSelectedKategoriDoc("penjualan")}
                  >
                    Penjualan
                  </Button>
                  <Button
                    variant={
                      selectedKategoriDoc === "audit" ? "primary" : "secondary"
                    }
                    size="sm"
                    onClick={() => setSelectedKategoriDoc("audit")}
                  >
                    Audit
                  </Button>
                </div>
              </div>

              {/* Search Bar & Counter */}
              <div className="flex flex-col sm:flex-row items-center gap-3">
                <div className="relative flex-1 w-full">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Cari prefix (DIST, RSTK, OBL, RFD...), nama dokumen, atau model database..."
                    value={searchDoc}
                    onChange={(e) => setSearchDoc(e.target.value)}
                    className="w-full pl-9 pr-4 py-1.5 text-xs rounded-lg bg-white dark:bg-surface border border-slate-200 dark:border-line text-slate-900 dark:text-fg focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <span className="text-xs text-slate-400 dark:text-fg-muted shrink-0">
                  Menampilkan {filteredDokumen.length} dari{" "}
                  {DAFTAR_DOKUMEN.length} Dokumen
                </span>
              </div>

              {/* TAMPILAN TABEL RESMI BERSIH (CLEAN & TIDY) */}
              <TableContainer>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-20">Prefix</TableHead>
                      <TableHead>Nama Dokumen &amp; Model</TableHead>
                      <TableHead>Kategori</TableHead>
                      <TableHead>Alur Transaksi</TableHead>
                      <TableHead className="text-right">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredDokumen.map((doc) => (
                      <TableRow
                        key={doc.prefix}
                        className="cursor-pointer hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                        onClick={() => setSelectedDocDetail(doc)}
                      >
                        <TableCell>
                          <span className="px-2 py-0.5 rounded font-mono font-bold text-xs bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-fg border border-slate-200 dark:border-line">
                            {doc.prefix}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="font-semibold text-slate-900 dark:text-fg text-xs sm:text-sm">
                            {doc.nama}
                          </div>
                          <div className="text-[11px] font-mono text-slate-400 dark:text-fg-muted mt-0.5 flex flex-wrap items-center gap-1.5">
                            <span>Model: {doc.modelPrisma}</span>
                            <span>&bull;</span>
                            <span>Format: {doc.formatNomor}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs text-slate-600 dark:text-fg-muted font-medium whitespace-nowrap">
                          {doc.kategori === "stok"
                            ? "Stok & Logistik"
                            : doc.kategori === "penjualan"
                              ? "Penjualan"
                              : "Audit & Koreksi"}
                        </TableCell>
                        <TableCell className="text-xs text-slate-600 dark:text-fg-muted font-medium whitespace-nowrap">
                          {doc.alurSingkat}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedDocDetail(doc);
                            }}
                          >
                            Detail SOP
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>

              {/* MODAL DETAIL SOP DOKUMEN */}
              {selectedDocDetail && (
                <Modal
                  isOpen={true}
                  onClose={() => setSelectedDocDetail(null)}
                  title={
                    <div className="flex items-center gap-2.5">
                      <span className="px-2.5 py-0.5 rounded font-mono font-bold text-sm bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-fg border border-slate-300 dark:border-line">
                        {selectedDocDetail.prefix}
                      </span>
                      <span>{selectedDocDetail.nama}</span>
                    </div>
                  }
                  subtitle={
                    <span className="text-xs text-slate-500 font-mono">
                      Model Database: {selectedDocDetail.modelPrisma} &bull;
                      Format: {selectedDocDetail.formatNomor}
                    </span>
                  }
                  size="lg"
                  footer={
                    <div className="flex justify-end">
                      <Button
                        variant="secondary"
                        onClick={() => setSelectedDocDetail(null)}
                      >
                        Tutup
                      </Button>
                    </div>
                  }
                >
                  <div className="space-y-4 py-1">
                    {/* Ringkasan Pihak & Alur */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/80 dark:border-line">
                      <div className="space-y-1">
                        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">
                          Pihak Penerbit
                        </span>
                        <p className="text-xs font-semibold text-slate-900 dark:text-fg">
                          {selectedDocDetail.diterbitkan}
                        </p>
                      </div>
                      <div className="space-y-1">
                        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">
                          Pihak Penerima
                        </span>
                        <p className="text-xs font-semibold text-slate-900 dark:text-fg">
                          {selectedDocDetail.diterima}
                        </p>
                      </div>
                    </div>

                    {/* Dampak Saldo Fisik */}
                    <div className="space-y-1.5">
                      <h4 className="text-xs font-bold text-slate-900 dark:text-fg uppercase tracking-wide">
                        Dampak Saldo Stok Fisik
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="p-3 rounded-lg border border-slate-200/80 dark:border-line space-y-1">
                          <span className="text-[11px] font-bold text-slate-500">
                            Stok Gerobak (Booth)
                          </span>
                          <p className="text-xs text-slate-800 dark:text-fg font-medium">
                            {selectedDocDetail.efekBooth}
                          </p>
                        </div>
                        <div className="p-3 rounded-lg border border-slate-200/80 dark:border-line space-y-1">
                          <span className="text-[11px] font-bold text-slate-500">
                            Stok Gudang Pusat
                          </span>
                          <p className="text-xs text-slate-800 dark:text-fg font-medium">
                            {selectedDocDetail.efekGudang}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* SOP Operasional & Aturan Bisnis */}
                    <div className="space-y-1.5">
                      <h4 className="text-xs font-bold text-slate-900 dark:text-fg uppercase tracking-wide">
                        Fungsi Bisnis &amp; Standard Operating Procedure (SOP)
                      </h4>
                      <div className="p-3.5 rounded-xl border border-slate-200/80 dark:border-line text-xs text-slate-700 dark:text-fg-muted leading-relaxed">
                        {selectedDocDetail.deskripsi}
                      </div>
                    </div>
                  </div>
                </Modal>
              )}
            </TabPanel>

            {/* ============================================================== */}
            {/* TAB 4: ATURAN KONSISTENSI DATA & SIMULATOR KOREKSI P0 */}
            {/* ============================================================== */}
            <TabPanel value="konsistensi" className="space-y-5 pt-1">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-fg">
                  Aturan Konsistensi Data &amp; Koreksi (Standar P0)
                </h2>
                <p className="text-xs text-slate-500 dark:text-fg-muted mt-0.5">
                  Standar kepatuhan audit tinggi: Tidak ada transaksi posted
                  yang di-hard delete atau diedit langsung.
                </p>
              </div>

              {/* 4 Prinsip Konsistensi Data */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="p-3.5 rounded-xl bg-white dark:bg-surface border border-slate-200/80 dark:border-line space-y-1">
                  <div className="text-xs font-bold text-slate-900 dark:text-fg">
                    1. Dilarang Hard Delete
                  </div>
                  <p className="text-xs text-slate-500 dark:text-fg-muted leading-relaxed">
                    Setiap transaksi yang sudah terposting (POSTED) tidak boleh
                    dihapus. Pembatalan dilakukan dengan status{" "}
                    <strong>VOIDED</strong> atau mutasi pembalik.
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-white dark:bg-surface border border-slate-200/80 dark:border-line space-y-1">
                  <div className="text-xs font-bold text-slate-900 dark:text-fg">
                    2. Revisi = Reversal V1 + Replacement V2
                  </div>
                  <p className="text-xs text-slate-500 dark:text-fg-muted leading-relaxed">
                    Sistem membalikkan dampak versi lama secara penuh lalu
                    memposting versi baru pengganti dalam satu database
                    transaction atomik.
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-white dark:bg-surface border border-slate-200/80 dark:border-line space-y-1">
                  <div className="text-xs font-bold text-slate-900 dark:text-fg">
                    3. Ledger Append-Only
                  </div>
                  <p className="text-xs text-slate-500 dark:text-fg-muted leading-relaxed">
                    Tabel{" "}
                    <code className="font-mono text-xs">stock_movements</code>{" "}
                    dilindungi trigger database. Baris mutasi hanya boleh
                    di-INSERT, dilarang di-UPDATE atau di-DELETE.
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-white dark:bg-surface border border-slate-200/80 dark:border-line space-y-1">
                  <div className="text-xs font-bold text-slate-900 dark:text-fg">
                    4. Fakta Hitung Fisik Tidak Dimanipulasi
                  </div>
                  <p className="text-xs text-slate-500 dark:text-fg-muted leading-relaxed">
                    Hasil hitung fisik closing adalah fakta lapangan. Jika ada
                    salah catat, diterbitkan dokumen <strong>Recount V2</strong>{" "}
                    dan penyesuaian kompensasi.
                  </p>
                </div>
              </div>

              {/* Komparasi Void vs Refund */}
              <div className="p-4 rounded-xl bg-slate-50/70 dark:bg-surface border border-slate-200/80 dark:border-line space-y-2.5">
                <div className="text-xs font-bold text-slate-900 dark:text-fg">
                  Perbedaan: VOID vs SALES RETURN / REFUND
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  <div className="p-3 rounded-lg bg-white dark:bg-panel border border-slate-200/80 dark:border-line space-y-1">
                    <span className="font-bold text-slate-800 dark:text-fg uppercase text-[11px]">
                      VOID (Batal Input)
                    </span>
                    <p className="text-slate-500 dark:text-fg-muted">
                      Dipakai saat kasir salah input (misal salah produk/qty).
                      Transaksi dianggap <strong>tidak pernah sah</strong>. Uang
                      kasir dan stok cup dikembalikan utuh 100%.
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-white dark:bg-panel border border-slate-200/80 dark:border-line space-y-1">
                    <span className="font-bold text-slate-800 dark:text-fg uppercase text-[11px]">
                      REFUND / SALES RETURN
                    </span>
                    <p className="text-slate-500 dark:text-fg-muted">
                      Transaksi awal <strong>sah dan terjadi</strong>, lalu
                      pelanggan komplain. Sistem menggunakan{" "}
                      <code className="font-mono">REFUND_NO_STOCK_RETURN</code>{" "}
                      (uang balik ke customer, stok terbuang tidak masuk
                      inventaris).
                    </p>
                  </div>
                </div>
              </div>

              {/* SIMULATOR KOREKSI INTERAKTIF */}
              <div className="p-4 rounded-xl bg-white dark:bg-surface border border-slate-200/90 dark:border-line space-y-3.5">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-fg">
                      Simulator Dampak Koreksi Terpadu
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-fg-muted">
                      Pilih skenario untuk melihat otomatisasi penghitungan
                      ulang sistem:
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {SKENARIO_KOREKSI.map((s) => (
                      <Button
                        key={s.id}
                        variant={
                          activeSkenario === s.id ? "primary" : "secondary"
                        }
                        size="sm"
                        onClick={() => setActiveSkenario(s.id)}
                      >
                        {s.judul.split("(")[0]}
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-slate-50 dark:bg-panel border border-slate-200/80 dark:border-line text-xs space-y-1">
                  <div className="font-bold text-slate-900 dark:text-fg">
                    {selectedSkenarioData.judul}
                  </div>
                  <p className="text-slate-600 dark:text-fg-muted">
                    {selectedSkenarioData.deskripsiMasalah}
                  </p>
                </div>

                {/* 3 Langkah Alur Koreksi: V1 -> Reversal -> V2 */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                  <div className="p-3 rounded-lg bg-slate-50/70 dark:bg-panel border border-slate-200 dark:border-line space-y-1.5">
                    <div className="text-[11px] font-bold text-slate-500 uppercase">
                      Langkah 1: Versi Awal (V1)
                    </div>
                    <div className="font-semibold text-slate-900 dark:text-fg">
                      {selectedSkenarioData.versiAwal.dokumen}
                    </div>
                    <div className="text-slate-500 dark:text-fg-muted">
                      {selectedSkenarioData.versiAwal.detail}
                    </div>
                    <div className="text-[11px] text-slate-600 dark:text-fg-muted pt-1 border-t border-slate-200 dark:border-line">
                      {selectedSkenarioData.versiAwal.stokTerdampak}
                    </div>
                  </div>

                  <div className="p-3 rounded-lg bg-slate-50/70 dark:bg-panel border border-slate-200 dark:border-line space-y-1.5">
                    <div className="text-[11px] font-bold text-slate-500 uppercase">
                      Langkah 2: Mutasi Reversal
                    </div>
                    <div className="font-semibold text-slate-900 dark:text-fg">
                      {selectedSkenarioData.reversalAction.tipe}
                    </div>
                    <div className="text-slate-500 dark:text-fg-muted">
                      {selectedSkenarioData.reversalAction.efek}
                    </div>
                    <div className="text-[11px] font-mono text-slate-600 dark:text-fg-muted pt-1 border-t border-slate-200 dark:border-line">
                      {selectedSkenarioData.reversalAction.ledger}
                    </div>
                  </div>

                  <div className="p-3 rounded-lg bg-slate-50/70 dark:bg-panel border border-slate-200 dark:border-line space-y-1.5">
                    <div className="text-[11px] font-bold text-slate-500 uppercase">
                      Langkah 3: Versi Pengganti (V2)
                    </div>
                    <div className="font-semibold text-slate-900 dark:text-fg">
                      {selectedSkenarioData.versiPengganti.dokumen}
                    </div>
                    <div className="text-slate-500 dark:text-fg-muted">
                      {selectedSkenarioData.versiPengganti.detail}
                    </div>
                    <div className="text-[11px] font-mono text-slate-600 dark:text-fg-muted pt-1 border-t border-slate-200 dark:border-line">
                      {selectedSkenarioData.versiPengganti.ledger}
                    </div>
                  </div>
                </div>

                {/* Dampak Otomatis Rekonsiliasi */}
                <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-panel border border-slate-200 dark:border-line space-y-1.5 text-xs">
                  <div className="font-bold text-slate-900 dark:text-fg text-[11px] uppercase">
                    Dampak Otomatis Rekonsiliasi Sistem:
                  </div>
                  <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-600 dark:text-fg-muted">
                    <li className="flex items-start gap-1.5">
                      <span className="font-semibold text-slate-800 dark:text-fg">
                        Omzet:
                      </span>{" "}
                      {selectedSkenarioData.dampakOtomatis.omzetNet}
                    </li>
                    <li className="flex items-start gap-1.5">
                      <span className="font-semibold text-slate-800 dark:text-fg">
                        Stok Proyeksi:
                      </span>{" "}
                      {selectedSkenarioData.dampakOtomatis.stokAkhir}
                    </li>
                    <li className="flex items-start gap-1.5 sm:col-span-2">
                      <span className="font-semibold text-slate-800 dark:text-fg">
                        Discrepancy:
                      </span>{" "}
                      {selectedSkenarioData.dampakOtomatis.closingDiscrepancy}
                    </li>
                  </ul>
                </div>
              </div>
            </TabPanel>

            {/* ============================================================== */}
            {/* TAB 5: PANDUAN OPERASIONAL LAPANGAN (MOBILE APPS) */}
            {/* ============================================================== */}
            <TabPanel value="mobile" className="space-y-5 pt-1">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-fg">
                  Panduan Pengoperasian Aplikasi Mobile (Flutter Android)
                </h2>
                <p className="text-xs text-slate-500 dark:text-fg-muted mt-0.5">
                  Tata cara kerja harian tim kasir di gerobak dan pemantauan
                  eksekutif bagi pemilik bisnis.
                </p>
              </div>

              {/* Sub-Section 1: Petugas Booth POS */}
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-slate-900 dark:text-fg border-b border-slate-200 dark:border-line pb-1.5">
                  A. Panduan Kerja Harian Petugas Booth (Kasir POS)
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="p-3.5 rounded-xl bg-white dark:bg-surface border border-slate-200/80 dark:border-line space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-md bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-fg font-bold text-xs flex items-center justify-center">
                        1
                      </span>
                      <h4 className="text-xs font-bold text-slate-900 dark:text-fg">
                        Pagi: Terima Stok Awal (DIST)
                      </h4>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-fg-muted leading-relaxed">
                      Buka aplikasi Obbel Booth, cek fisik cup yang diantar dari
                      gudang, cocokkan jumlahnya, lalu tekan{" "}
                      <strong>Terima</strong>. Status shift otomatis menjadi{" "}
                      <strong>OPEN</strong>.
                    </p>
                  </div>

                  <div className="p-3.5 rounded-xl bg-white dark:bg-surface border border-slate-200/80 dark:border-line space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-md bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-fg font-bold text-xs flex items-center justify-center">
                        2
                      </span>
                      <h4 className="text-xs font-bold text-slate-900 dark:text-fg">
                        Siang: Transaksi 2–4 Tap (OBL/PAY)
                      </h4>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-fg-muted leading-relaxed">
                      Pilih menu pelanggan &rarr; pilih metode{" "}
                      <strong>Tunai</strong> atau <strong>QRIS</strong> &rarr;
                      tekan <strong>Bayar &amp; Cetak Nota</strong> via printer
                      Bluetooth portabel.
                    </p>
                  </div>

                  <div className="p-3.5 rounded-xl bg-white dark:bg-surface border border-slate-200/80 dark:border-line space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-md bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-fg font-bold text-xs flex items-center justify-center">
                        3
                      </span>
                      <h4 className="text-xs font-bold text-slate-900 dark:text-fg">
                        Tengah Hari: Ajukan Restock (RSTK)
                      </h4>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-fg-muted leading-relaxed">
                      Jika kartu produk menyala oranye atau merah, tap{" "}
                      <strong>Minta Restock</strong>, pilih kuantitas (5/10/15
                      cup), dan kirim ke Admin Gudang.
                    </p>
                  </div>

                  <div className="p-3.5 rounded-xl bg-white dark:bg-surface border border-slate-200/80 dark:border-line space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-md bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-fg font-bold text-xs flex items-center justify-center">
                        4
                      </span>
                      <h4 className="text-xs font-bold text-slate-900 dark:text-fg">
                        Sore: Tutup Shift (CNT) &amp; Retur (RTN)
                      </h4>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-fg-muted leading-relaxed">
                      Tekan <strong>Tutup Shift</strong> &rarr; hitung fisik cup
                      sisa di gerobak &rarr; konfirmasi closing &rarr; bawa sisa
                      cup fisik ke Gudang Pusat dan tekan{" "}
                      <strong>Kembalikan Stok</strong>.
                    </p>
                  </div>
                </div>
              </div>

              {/* Sub-Section 2: Owner Dashboard */}
              <div className="space-y-3 pt-2">
                <h3 className="text-sm font-bold text-slate-900 dark:text-fg border-b border-slate-200 dark:border-line pb-1.5">
                  B. Panduan Monitoring Eksekutif (Owner Mobile)
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="p-3.5 rounded-xl bg-white dark:bg-surface border border-slate-200/80 dark:border-line space-y-1">
                    <div className="text-xs font-bold text-slate-900 dark:text-fg">
                      Membaca Omzet &amp; Penjualan Harian
                    </div>
                    <p className="text-xs text-slate-500 dark:text-fg-muted leading-relaxed">
                      Beranda Owner menampilkan omzet bersih (hanya transaksi
                      PAID, mengecualikan VOID) dan total cup terjual hari ini
                      beserta perbandingan trennya.
                    </p>
                  </div>

                  <div className="p-3.5 rounded-xl bg-white dark:bg-surface border border-slate-200/80 dark:border-line space-y-1">
                    <div className="text-xs font-bold text-slate-900 dark:text-fg">
                      Peringkat Produktivitas Booth
                    </div>
                    <p className="text-xs text-slate-500 dark:text-fg-muted leading-relaxed">
                      Tabel peringkat menampilkan booth terlaris berdasarkan
                      omzet dan cup sold, memudahkan evaluasi performa lokasi
                      gerobak.
                    </p>
                  </div>

                  <div className="p-3.5 rounded-xl bg-white dark:bg-surface border border-slate-200/80 dark:border-line space-y-1">
                    <div className="text-xs font-bold text-slate-900 dark:text-fg">
                      Indikator Kerugian Selisih (Discrepancy)
                    </div>
                    <p className="text-xs text-slate-500 dark:text-fg-muted leading-relaxed">
                      Owner dapat melihat estimasi nilai rupiah dari cup yang
                      hilang atau rusak saat closing shift di setiap booth untuk
                      mitigasi kebocoran.
                    </p>
                  </div>

                  <div className="p-3.5 rounded-xl bg-white dark:bg-surface border border-slate-200/80 dark:border-line space-y-1">
                    <div className="text-xs font-bold text-slate-900 dark:text-fg">
                      Keamanan Read-Only Terjamin
                    </div>
                    <p className="text-xs text-slate-500 dark:text-fg-muted leading-relaxed">
                      Aplikasi Owner 100% aman tanpa tombol mutasi data stok
                      atau finansial, menghindari risiko perubahan data
                      operasional yang tidak sengaja.
                    </p>
                  </div>
                </div>
              </div>
            </TabPanel>
          </TabPanels>
        </Tabs>
      </Card>
    </div>
  );
};
