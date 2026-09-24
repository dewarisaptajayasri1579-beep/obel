import 'package:flutter/material.dart';

// Data dummy untuk halaman Riwayat Stok. Mencakup dua jenis riwayat:
// - HistoryType.submission -> "Pengajuan Restock" (saat staff mengajukan restock)
// - HistoryType.receipt    -> "Penerimaan Stok" (saat stok fisik diterima booth)
//
// Semua teks tampilan (badge, baris info, footer) sengaja disimpan sebagai
// field string langsung di data dummy (bukan dihitung dari logika), supaya
// mudah disesuaikan satu-satu tanpa mengubah widget-nya.

enum HistoryType { submission, receipt }

class HistoryProductLine {
  final String name;
  final int qty;

  const HistoryProductLine(this.name, this.qty);

  String get label => '$name (+$qty)';
}

class DummyHistoryEntry {
  final String id; // mis. "RSTK-0842"
  final HistoryType type;
  final DateTime time;
  final String title; // "Penerimaan Stok" / "Pengajuan Restock"
  final String topInfoLabel; // baris pertama kotak abu, mis. "2 SKU Masuk • Dari Gudang Utama"
  final List<HistoryProductLine> products;
  final String? badgeLabel; // null = tidak ada badge (mis. entri hari ini yang masih baru)
  final Color badgeColor;
  final String footerLabel; // mis. "Penerima: Dimas S." / "Status: Menunggu Persetujuan"

  const DummyHistoryEntry({
    required this.id,
    required this.type,
    required this.time,
    required this.title,
    required this.topInfoLabel,
    required this.products,
    this.badgeLabel,
    this.badgeColor = Colors.grey,
    required this.footerLabel,
  });

  int get totalQty => products.fold(0, (total, p) => total + p.qty);
}

List<DummyHistoryEntry> buildDummyStockHistory() {
  final now = DateTime.now();

  DateTime today(int hour, int minute) =>
      DateTime(now.year, now.month, now.day, hour, minute);

  DateTime daysAgo(int days, int hour, int minute) => DateTime(
        now.year,
        now.month,
        now.day - days,
        hour,
        minute,
      );

  return [
    // --- Hari ini ---
    DummyHistoryEntry(
      id: 'RSTK-0842',
      type: HistoryType.receipt,
      time: today(11, 45),
      title: 'Penerimaan Stok',
      topInfoLabel: '2 SKU Masuk • Dari Gudang Utama',
      products: const [
        HistoryProductLine('Almond Milk Fresh', 10),
        HistoryProductLine('Kopsu Premium', 9),
      ],
      badgeLabel: null, // masih baru, tidak perlu badge status
      footerLabel: 'Penerima: Dimas S.',
    ),
    DummyHistoryEntry(
      id: 'RSTK-0844',
      type: HistoryType.submission,
      time: today(9, 15),
      title: 'Pengajuan Restock',
      topInfoLabel: '2 SKU Diajukan',
      products: const [
        HistoryProductLine('QA2 Signature Tea', 10),
        HistoryProductLine('Maca Stroberi', 16),
      ],
      badgeLabel: 'Menunggu Persetujuan',
      badgeColor: Colors.amber.shade800,
      footerLabel: 'Diajukan oleh: Kak Rina',
    ),

    // --- Kemarin ---
    DummyHistoryEntry(
      id: 'RSTK-0839',
      type: HistoryType.receipt,
      time: daysAgo(1, 14, 15),
      title: 'Penerimaan Stok',
      topInfoLabel: '2 SKU Masuk • Dari Gudang Pusat Citra',
      products: const [
        HistoryProductLine('Sirup Karamel', 15),
        HistoryProductLine('Bubuk Matcha', 15),
      ],
      badgeLabel: 'Selesai Diterima',
      badgeColor: Colors.green.shade700,
      footerLabel: 'Penerima: Rina W.',
    ),
    DummyHistoryEntry(
      id: 'RSTK-0837',
      type: HistoryType.submission,
      time: daysAgo(1, 10, 5),
      title: 'Pengajuan Restock',
      topInfoLabel: '1 SKU Diajukan',
      products: const [
        HistoryProductLine('Brown Sugar Macchiato', 15),
      ],
      badgeLabel: 'Disetujui',
      badgeColor: Colors.green.shade700,
      footerLabel: 'Disetujui oleh: Supervisor Andi',
    ),

    // --- 3 hari lalu ---
    DummyHistoryEntry(
      id: 'RSTK-0831',
      type: HistoryType.submission,
      time: daysAgo(3, 16, 30),
      title: 'Pengajuan Restock',
      topInfoLabel: '1 SKU Diajukan',
      products: const [
        HistoryProductLine('Original Coffee Blend', 20),
      ],
      badgeLabel: 'Ditolak',
      badgeColor: Colors.redAccent,
      footerLabel: 'Alasan: Stok gudang pusat kosong',
    ),
  ];
}