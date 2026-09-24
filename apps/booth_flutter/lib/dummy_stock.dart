// Data dummy untuk keperluan pratinjau/testing tampilan StockScreen versi
// rinci (kartu per produk + kategori induk menu + filter status).
//
// Field:
//   id           -> identifier unik
//   name         -> nama produk
//   sku          -> kode SKU
//   category     -> kategori induk menu (Kopi Susu / Bahan Baku / Susu / Topping)
//   status       -> StockStatus (aman / menipis / kritis / habis)
//   qty          -> jumlah stok saat ini
//   unit         -> satuan ("cup" / "kotak")
//   thresholdLabel -> teks ambang batas, mis. "Ambang: Min 20 cup"
//   targetLabel  -> teks target (opsional), mis. "Target: 30 cup"
//   statusNote   -> catatan status di bawah angka, mis. "Restock URGENT"
//   quickAddOptions -> pilihan cepat jumlah restock, mis. [5, 10, 15, 20]
//   defaultQuickAdd -> nilai yang tersorot/terpilih secara default
//   lastUpdate   -> waktu update terakhir

enum StockStatus { aman, menipis, kritis, habis }

class DummyStockItem {
  final String id;
  final String name;
  final String sku;
  final String category;
  final StockStatus status;
  final int qty;
  final String unit;
  final String thresholdLabel;
  final String? targetLabel;
  final String badgeLabel; // teks pada badge status, mis. "Kritis (≤10)"
  final String statusNote;
  final List<int> quickAddOptions;
  final int defaultQuickAdd;
  final DateTime lastUpdate;
  final bool isRawMaterial;

  const DummyStockItem({
    required this.id,
    required this.name,
    required this.sku,
    required this.category,
    required this.status,
    required this.qty,
    required this.unit,
    required this.thresholdLabel,
    this.targetLabel,
    required this.badgeLabel,
    required this.statusNote,
    required this.quickAddOptions,
    required this.defaultQuickAdd,
    required this.lastUpdate,
    this.isRawMaterial = false,
  });
}

List<DummyStockItem> buildDummyStock() {
  final now = DateTime.now();
  DateTime today(int hour, int minute) =>
      DateTime(now.year, now.month, now.day, hour, minute);

  return [
    // --- Habis ---
    DummyStockItem(
      id: 'ac25',
      name: 'AC25 Test Product',
      sku: '1788791737574',
      category: 'Kopi Susu',
      status: StockStatus.habis,
      qty: 0,
      unit: 'cup',
      thresholdLabel: 'Ambang: Min 20 cup',
      badgeLabel: 'Habis',
      statusNote: 'Stok Kosong!',
      quickAddOptions: const [10, 20, 50],
      defaultQuickAdd: 20,
      lastUpdate: today(7, 15),
    ),

    // --- Kritis ---
    DummyStockItem(
      id: 'bsm',
      name: 'Brown Sugar Macchiato',
      sku: 'BSM-0821-X',
      category: 'Kopi Susu',
      status: StockStatus.kritis,
      qty: 8,
      unit: 'cup',
      thresholdLabel: 'Kritis (≤10)',
      targetLabel: 'Target: 30 cup',
      badgeLabel: 'Kritis (≤10)',
      statusNote: 'Tersisa 8 porsi',
      quickAddOptions: const [5, 10, 15, 20],
      defaultQuickAdd: 15,
      lastUpdate: today(11, 20),
    ),
    DummyStockItem(
      id: 'uht',
      name: 'Susu UHT Barista 1L',
      sku: 'UHT-MILK-1000',
      category: 'Bahan Baku',
      status: StockStatus.kritis,
      qty: 2,
      unit: 'kotak',
      thresholdLabel: 'Ambang: Min 6 kotak',
      badgeLabel: 'Kritis (Bahan Baku)',
      statusNote: 'Restock URGENT',
      quickAddOptions: const [6, 12, 24],
      defaultQuickAdd: 12,
      lastUpdate: today(10, 45),
      isRawMaterial: true,
    ),

    // --- Menipis ---
    DummyStockItem(
      id: 'qa2',
      name: 'QA2 Signature Tea',
      sku: 'QA2-99381',
      category: 'Kopi Susu',
      status: StockStatus.menipis,
      qty: 16,
      unit: 'cup',
      thresholdLabel: 'Min: 20 cup',
      badgeLabel: 'Menipis (≤20)',
      statusNote: 'Perlu Order',
      quickAddOptions: const [5, 10, 20],
      defaultQuickAdd: 10,
      lastUpdate: today(10, 15),
    ),
    DummyStockItem(
      id: 'maca',
      name: 'Maca Stroberi',
      sku: 'MC-STR-401',
      category: 'Susu',
      status: StockStatus.menipis,
      qty: 19,
      unit: 'cup',
      thresholdLabel: 'Min: 20 cup',
      badgeLabel: 'Menipis (≤20)',
      statusNote: 'Hampir batas',
      quickAddOptions: const [10, 15, 20],
      defaultQuickAdd: 20,
      lastUpdate: today(9, 50),
    ),

    // --- Aman ---
    DummyStockItem(
      id: 'orig',
      name: 'Original Coffee Blend',
      sku: 'ORG-001-CUP',
      category: 'Bahan Baku',
      status: StockStatus.aman,
      qty: 175,
      unit: 'cup',
      thresholdLabel: 'Aman (>20)',
      badgeLabel: 'Aman (>20)',
      statusNote: 'Stok Mencukupi',
      quickAddOptions: const [10, 20, 30],
      defaultQuickAdd: 20,
      lastUpdate: today(11, 45),
    ),
    DummyStockItem(
      id: 'scl',
      name: 'Salted Caramel Latte',
      sku: 'SCL-129-CUP',
      category: 'Kopi Susu',
      status: StockStatus.aman,
      qty: 45,
      unit: 'cup',
      thresholdLabel: 'Aman (>20)',
      badgeLabel: 'Aman (>20)',
      statusNote: 'Stok Siap Jual',
      quickAddOptions: const [10, 20, 30],
      defaultQuickAdd: 20,
      lastUpdate: today(10, 15),
    ),
    DummyStockItem(
      id: 'mkl',
      name: 'Matcha Kyoto Latte',
      sku: 'MCH-KYT-02',
      category: 'Kopi Susu',
      status: StockStatus.aman,
      qty: 62,
      unit: 'cup',
      thresholdLabel: 'Aman (>20)',
      badgeLabel: 'Aman (>20)',
      statusNote: 'Stok Melimpah',
      quickAddOptions: const [10, 20, 30],
      defaultQuickAdd: 20,
      lastUpdate: today(11, 30),
    ),
    DummyStockItem(
      id: 'egm',
      name: 'Earl Grey Milk Tea',
      sku: 'EGM-882-TEA',
      category: 'Susu',
      status: StockStatus.aman,
      qty: 38,
      unit: 'cup',
      thresholdLabel: 'Aman (>20)',
      badgeLabel: 'Aman (>20)',
      statusNote: 'Stok Cukup',
      quickAddOptions: const [10, 20, 30],
      defaultQuickAdd: 20,
      lastUpdate: today(9, 40),
    ),
    DummyStockItem(
      id: 'taro',
      name: 'Taro Fresh Milk',
      sku: 'TRO-410-CUP',
      category: 'Susu',
      status: StockStatus.aman,
      qty: 54,
      unit: 'cup',
      thresholdLabel: 'Aman (>20)',
      badgeLabel: 'Aman (>20)',
      statusNote: 'Stok Tersedia',
      quickAddOptions: const [10, 20, 30],
      defaultQuickAdd: 20,
      lastUpdate: today(8, 50),
    ),
    DummyStockItem(
      id: 'choco',
      name: 'Chocolate Deluxe',
      sku: 'CHD-220-CUP',
      category: 'Kopi Susu',
      status: StockStatus.aman,
      qty: 41,
      unit: 'cup',
      thresholdLabel: 'Aman (>20)',
      badgeLabel: 'Aman (>20)',
      statusNote: 'Stok Tersedia',
      quickAddOptions: const [10, 20, 30],
      defaultQuickAdd: 20,
      lastUpdate: today(9, 05),
    ),
    DummyStockItem(
      id: 'rv',
      name: 'Red Velvet Cream',
      sku: 'RVC-333-CUP',
      category: 'Topping',
      status: StockStatus.aman,
      qty: 29,
      unit: 'cup',
      thresholdLabel: 'Aman (>20)',
      badgeLabel: 'Aman (>20)',
      statusNote: 'Stok Tersedia',
      quickAddOptions: const [10, 20, 30],
      defaultQuickAdd: 20,
      lastUpdate: today(8, 20),
    ),
  ];
}