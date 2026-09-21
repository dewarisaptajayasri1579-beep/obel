import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../app_state.dart';
import '../theme.dart';
import '../dummy_stock.dart';
import 'restock_detail_screen.dart';
import 'stock_history_screen.dart';

// =====================================================================
// HELPER TAMPILAN STATUS STOK
// =====================================================================

const Color _kGreen = ObbelTheme.primaryDark;

Color _statusColor(StockStatus s) {
  switch (s) {
    case StockStatus.aman:
      return const Color(0xFF1E8E5A);

    case StockStatus.menipis:
      return Colors.amber.shade800;

    case StockStatus.kritis:
      return ObbelTheme.accentOrange;

    case StockStatus.habis:
      return Colors.redAccent;
  }
}

Color _statusBg(StockStatus s) {
  return _statusColor(s).withValues(alpha: 0.10);
}

Color _statusBorder(StockStatus s) {
  return _statusColor(s).withValues(alpha: 0.35);
}

String _statusLabel(StockStatus s) {
  switch (s) {
    case StockStatus.aman:
      return 'Aman';

    case StockStatus.menipis:
      return 'Menipis';

    case StockStatus.kritis:
      return 'Kritis';

    case StockStatus.habis:
      return 'Habis';
  }
}

IconData _categoryIcon(String category) {
  switch (category) {
    case 'Bahan Baku':
      return Icons.local_drink_outlined;

    case 'Susu':
      return Icons.icecream_outlined;

    case 'Topping':
      return Icons.blender_outlined;

    default:
      return Icons.coffee_outlined;
  }
}

String _two(int v) {
  return v.toString().padLeft(2, '0');
}

String _timeLabel(DateTime d) {
  return '${_two(d.hour)}:${_two(d.minute)} WIB';
}

// =====================================================================
// STOCK SCREEN
// =====================================================================

class StockScreen extends StatefulWidget {
  const StockScreen({
    super.key,
    this.pickForRestock = false,
    this.alreadyAddedIds = const {},
  });

  /// Ketika true, layar ini dibuka sebagai mode "pilih produk" dari
  /// RestockDetailScreen (lewat tombol "Tambah Produk Lain ke Pengajuan").
  /// Dalam mode ini: produk yang sudah ada di draft disembunyikan dari
  /// daftar, tombol restock per-item disembunyikan (tap kartu = pilih),
  /// dan bar seleksi di bawah akan langsung mengembalikan (pop) daftar
  /// produk yang dipilih ke RestockDetailScreen supaya digabung ke draft
  /// yang sedang berjalan (bukan membuka draft/halaman baru).
  final bool pickForRestock;

  /// ID produk yang sudah ada di draft RestockDetailScreen saat ini,
  /// dipakai untuk menyembunyikannya dari daftar pilihan supaya tidak
  /// dobel ditambahkan.
  final Set<String> alreadyAddedIds;

  @override
  State<StockScreen> createState() => _StockScreenState();
}

class _StockScreenState extends State<StockScreen> {
  // ===================================================================
  // DATA STOCK
  // ===================================================================

  List<DummyStockItem> get _allStock {
    final stocks = context.read<AppState>().stock;
    final now = DateTime.now();

    return stocks.map((stock) {
      final status = switch (stock.status) {
        'Habis' => StockStatus.habis,
        'Kritis' => StockStatus.kritis,
        'Menipis' => StockStatus.menipis,
        _ => StockStatus.aman,
      };
      final statusLabel = _statusLabel(status);

      return DummyStockItem(
        id: stock.product.id,
        name: stock.product.name,
        sku: stock.product.sku.isEmpty ? stock.product.id : stock.product.sku,
        category: stock.product.category,
        status: status,
        qty: stock.currentQty,
        unit: 'cup',
        thresholdLabel: 'Status: $statusLabel',
        badgeLabel: statusLabel,
        statusNote: status == StockStatus.aman
            ? 'Stok mencukupi'
            : 'Perlu perhatian',
        quickAddOptions: const [10, 20, 30],
        defaultQuickAdd: 20,
        lastUpdate: now,
      );
    }).toList();
  }

  // ===================================================================
  // FILTER
  // ===================================================================

  String _categoryFilter = 'Semua';

  StockStatus? _statusFilter;

  // ===================================================================
  // SEARCH
  // ===================================================================

  final TextEditingController _searchController = TextEditingController();

  String _searchQuery = '';

  bool _isSearching = false;

  // ===================================================================
  // QUICK ADD
  // ===================================================================

  final Map<String, int> _quickAddSelection = {};

  // ===================================================================
  // SELECTED PRODUCT
  // ===================================================================

  final Set<String> _selectedIds = {};

  // ===================================================================
  // DISPOSE
  // ===================================================================

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  // ===================================================================
  // CATEGORY
  // ===================================================================

  List<String> get _categories {
    final set = <String>{'Semua'};

    for (final item in _allStock) {
      set.add(item.category);
    }

    return set.toList();
  }

  Map<String, int> get _categoryCounts {
    final counts = <String, int>{};

    for (final item in _allStock) {
      counts[item.category] = (counts[item.category] ?? 0) + 1;
    }

    return counts;
  }

  // ===================================================================
  // FILTERED DATA
  // ===================================================================

  List<DummyStockItem> get _filtered {
    final query = _searchQuery.trim().toLowerCase();

    return _allStock.where((item) {
      // Mode pilih produk: jangan tampilkan produk yang sudah ada
      // di draft pengajuan.
      if (widget.pickForRestock && widget.alreadyAddedIds.contains(item.id)) {
        return false;
      }

      final matchCategory =
          _categoryFilter == 'Semua' || item.category == _categoryFilter;

      final matchStatus = _statusFilter == null || item.status == _statusFilter;

      final matchSearch =
          query.isEmpty ||
          item.name.toLowerCase().contains(query) ||
          item.sku.toLowerCase().contains(query);

      return matchCategory && matchStatus && matchSearch;
    }).toList();
  }

  // ===================================================================
  // STATUS COUNT
  // ===================================================================

  Map<StockStatus, int> get _statusCounts {
    final counts = <StockStatus, int>{};

    for (final item in _allStock) {
      if (widget.pickForRestock && widget.alreadyAddedIds.contains(item.id)) {
        continue;
      }

      if (_categoryFilter != 'Semua' && item.category != _categoryFilter) {
        continue;
      }

      counts[item.status] = (counts[item.status] ?? 0) + 1;
    }

    return counts;
  }

  // ===================================================================
  // QUICK ADD
  // ===================================================================

  int _quickAddFor(DummyStockItem item) {
    return _quickAddSelection[item.id] ?? item.defaultQuickAdd;
  }

  // ===================================================================
  // SELECT PRODUCT
  // ===================================================================

  void _toggleSelected(String id) {
    setState(() {
      if (_selectedIds.contains(id)) {
        _selectedIds.remove(id);
      } else {
        _selectedIds.add(id);
      }
    });
  }

  // ===================================================================
  // OPEN RESTOCK DETAIL - SATU PRODUK
  // ===================================================================

  void _openRestockDetail(DummyStockItem item) {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (context) {
          return RestockDetailScreen(
            items: [item],

            initialQuantities: {item.id: _quickAddFor(item)},
          );
        },
      ),
    );
  }

  // ===================================================================
  // OPEN RESTOCK DETAIL - BANYAK PRODUK
  // ===================================================================

  void _openBulkRestockDetail() {
    if (_selectedIds.isEmpty) {
      return;
    }

    // Ambil SEMUA produk yang dipilih
    final selectedItems = _allStock
        .where((item) => _selectedIds.contains(item.id))
        .toList();

    if (selectedItems.isEmpty) {
      return;
    }

    // Buka detail dengan seluruh produk
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (context) {
          return RestockDetailScreen(
            items: selectedItems,

            initialQuantities: {
              for (final item in selectedItems) item.id: _quickAddFor(item),
            },
          );
        },
      ),
    ).then((_) {
      if (!mounted) return;

      setState(() {
        _selectedIds.clear();
      });
    });
  }

  // ===================================================================
  // KONFIRMASI PILIHAN (MODE pickForRestock)
  // ===================================================================

  /// Dipanggil dari bar seleksi ketika layar ini dibuka dalam mode
  /// "pilih produk" (pickForRestock == true). Alih-alih membuka
  /// RestockDetailScreen baru, kita cukup mengembalikan (pop) daftar
  /// produk yang dipilih ke pemanggil (RestockDetailScreen yang sedang
  /// terbuka), supaya produk-produk itu digabung ke draft yang sama.
  void _confirmPick() {
    if (_selectedIds.isEmpty) {
      return;
    }

    final selectedItems = _allStock
        .where((item) => _selectedIds.contains(item.id))
        .toList();

    if (selectedItems.isEmpty) {
      return;
    }

    Navigator.pop(context, selectedItems);
  }

  // ===================================================================
  // SEARCH
  // ===================================================================

  void _openSearch() {
    setState(() {
      _isSearching = true;
    });
  }

  void _closeSearch() {
    setState(() {
      _isSearching = false;
      _searchQuery = '';
      _searchController.clear();
    });
  }

  // ===================================================================
  // BUILD
  // ===================================================================

  @override
  Widget build(BuildContext context) {
    context.watch<AppState>().stock;
    final needsRestock = _allStock
        .where(
          (item) =>
              item.status == StockStatus.kritis ||
              item.status == StockStatus.habis,
        )
        .length;

    final filtered = _filtered;

    final statusCounts = _statusCounts;

    final categoryCounts = _categoryCounts;

    return Scaffold(
      backgroundColor: ObbelTheme.backgroundLight,

      // ===============================================================
      // APP BAR
      // ===============================================================
      appBar: AppBar(
        automaticallyImplyLeading: false,

        title: _isSearching
            ? TextField(
                controller: _searchController,
                autofocus: true,

                onChanged: (value) {
                  setState(() {
                    _searchQuery = value;
                  });
                },

                decoration: const InputDecoration(
                  hintText: 'Cari nama atau SKU...',
                  border: InputBorder.none,
                  isDense: true,
                ),

                style: const TextStyle(
                  fontSize: 14,
                  color: ObbelTheme.textDark,
                ),
              )
            : Text(
                widget.pickForRestock
                    ? 'Tambah Produk ke Pengajuan'
                    : 'Stok Booth',
              ),

        actions: [
          if (_isSearching)
            IconButton(icon: const Icon(Icons.close), onPressed: _closeSearch)
          else
            IconButton(icon: const Icon(Icons.search), onPressed: _openSearch),

          IconButton(
            icon: const Icon(Icons.history),
            tooltip: 'Riwayat Stok',
            onPressed: () {
              Navigator.push(
                context,
                MaterialPageRoute(builder: (_) => const StockHistoryScreen()),
              );
            },
          ),
        ],
      ),

      // ===============================================================
      // BODY
      // ===============================================================
      body: Column(
        children: [
          if (widget.pickForRestock) _buildPickModeBanner(),

          Expanded(
            child: ListView(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),

              children: [
                // =====================================================
                // SEARCH INFO
                // =====================================================
                if (_searchQuery.trim().isNotEmpty) ...[
                  _buildSearchResultInfo(filtered.length),

                  const SizedBox(height: 12),
                ],

                // =====================================================
                // SUMMARY
                // =====================================================
                _buildSummaryRow(_allStock.length, needsRestock),

                const SizedBox(height: 16),

                // =====================================================
                // FILTER
                // =====================================================
                _buildFilterCard(categoryCounts, statusCounts),

                const SizedBox(height: 16),

                // =====================================================
                // HEADER
                // =====================================================
                _buildSectionHeader(filtered.length),

                const SizedBox(height: 10),

                // =====================================================
                // PRODUCT LIST
                // =====================================================
                if (filtered.isEmpty)
                  _buildEmptyState()
                else
                  for (final item in filtered) ...[
                    _buildProductCard(item),

                    const SizedBox(height: 10),
                  ],

                const SizedBox(height: 4),

                // =====================================================
                // HELP
                // =====================================================
                if (!widget.pickForRestock) _buildHelpCard(),

                const SizedBox(height: 16),
              ],
            ),
          ),

          // ===========================================================
          // BULK SELECTION BAR
          // ===========================================================
          if (_selectedIds.isNotEmpty) _buildSelectionBar(),
        ],
      ),
    );
  }

  // ===================================================================
  // PICK MODE BANNER
  // ===================================================================

  Widget _buildPickModeBanner() {
    return Container(
      width: double.infinity,
      margin: const EdgeInsets.fromLTRB(16, 12, 16, 0),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: const Color(0xFFE8F5E9),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: const Color(0xFFB7E1C1)),
      ),
      child: Row(
        children: [
          const Icon(Icons.playlist_add, size: 18, color: _kGreen),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              'Pilih produk lain, lalu tekan "Tambahkan" untuk '
              'menggabungkannya ke pengajuan restock yang sedang dibuat.',
              style: TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w600,
                color: _kGreen,
                height: 1.3,
              ),
            ),
          ),
        ],
      ),
    );
  }

  // ===================================================================
  // SEARCH RESULT INFO
  // ===================================================================

  Widget _buildSearchResultInfo(int resultCount) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),

      decoration: BoxDecoration(
        color: Colors.white,

        borderRadius: BorderRadius.circular(10),

        border: Border.all(color: Colors.grey.shade200),
      ),

      child: Row(
        children: [
          const Icon(Icons.search, size: 16, color: _kGreen),

          const SizedBox(width: 8),

          Expanded(
            child: Text(
              'Hasil pencarian untuk '
              '"$_searchQuery"',
              style: const TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w600,
                color: ObbelTheme.textDark,
              ),
            ),
          ),

          Text(
            '$resultCount item',
            style: const TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w700,
              color: _kGreen,
            ),
          ),
        ],
      ),
    );
  }

  // ===================================================================
  // SUMMARY
  // ===================================================================

  Widget _buildSummaryRow(int totalActive, int needsRestock) {
    return Row(
      children: [
        Expanded(
          child: Container(
            padding: const EdgeInsets.all(14),

            decoration: BoxDecoration(
              color: Colors.white,

              borderRadius: BorderRadius.circular(14),

              border: Border.all(color: Colors.grey.shade200, width: 1.2),
            ),

            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,

              children: [
                Container(
                  padding: const EdgeInsets.all(6),

                  decoration: BoxDecoration(
                    color: const Color(0xFFE8F5E9),

                    borderRadius: BorderRadius.circular(8),
                  ),

                  child: const Icon(
                    Icons.inventory_2_outlined,
                    size: 16,
                    color: _kGreen,
                  ),
                ),

                const SizedBox(height: 8),

                const Text(
                  'Total Item Aktif',

                  style: TextStyle(fontSize: 11, color: ObbelTheme.textLight),
                ),

                const SizedBox(height: 2),

                Text(
                  '$totalActive SKU Booth',

                  style: const TextStyle(
                    fontFamily: 'Outfit',
                    fontSize: 17,
                    fontWeight: FontWeight.w900,
                    color: ObbelTheme.textDark,
                  ),
                ),
              ],
            ),
          ),
        ),

        const SizedBox(width: 10),

        Expanded(
          child: Container(
            padding: const EdgeInsets.all(14),

            decoration: BoxDecoration(
              color: const Color(0xFFFFF9F5),

              borderRadius: BorderRadius.circular(14),

              border: Border.all(color: const Color(0xFFFFDEC9), width: 1.2),
            ),

            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,

              children: [
                Container(
                  padding: const EdgeInsets.all(6),

                  decoration: BoxDecoration(
                    color: Colors.white,

                    borderRadius: BorderRadius.circular(8),
                  ),

                  child: const Icon(
                    Icons.warning_amber_rounded,
                    size: 16,
                    color: ObbelTheme.accentOrange,
                  ),
                ),

                const SizedBox(height: 8),

                const Text(
                  'Perlu Restock Segera',

                  style: TextStyle(fontSize: 11, color: ObbelTheme.textLight),
                ),

                const SizedBox(height: 2),

                Text(
                  '$needsRestock SKU Kritis/Habis',

                  style: const TextStyle(
                    fontFamily: 'Outfit',
                    fontSize: 17,
                    fontWeight: FontWeight.w900,
                    color: ObbelTheme.accentOrange,
                  ),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }

  // ===================================================================
  // FILTER CARD
  // ===================================================================

  Widget _buildFilterCard(
    Map<String, int> categoryCounts,
    Map<StockStatus, int> statusCounts,
  ) {
    final totalStatus = statusCounts.values.fold<int>(0, (a, b) => a + b);

    return Container(
      padding: const EdgeInsets.fromLTRB(14, 14, 14, 12),

      decoration: BoxDecoration(
        color: Colors.white,

        borderRadius: BorderRadius.circular(16),

        border: Border.all(color: Colors.grey.shade200, width: 1.2),
      ),

      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,

        children: [
          _buildFilterLabel(Icons.category_outlined, 'Kategori'),

          const SizedBox(height: 8),

          SizedBox(
            height: 34,

            child: ListView(
              scrollDirection: Axis.horizontal,

              children: [
                _buildPillChip(
                  label: 'Semua',
                  count: _allStock.length,
                  color: _kGreen,
                  selected: _categoryFilter == 'Semua',

                  onTap: () {
                    setState(() {
                      _categoryFilter = 'Semua';
                    });
                  },
                ),

                for (final category in _categories.where((c) => c != 'Semua'))
                  _buildPillChip(
                    label: category,

                    count: categoryCounts[category] ?? 0,

                    color: _kGreen,

                    selected: _categoryFilter == category,

                    onTap: () {
                      setState(() {
                        _categoryFilter = category;
                      });
                    },
                  ),
              ],
            ),
          ),

          Padding(
            padding: const EdgeInsets.symmetric(vertical: 12),

            child: Divider(height: 1, color: Colors.grey.shade100),
          ),

          _buildFilterLabel(Icons.filter_alt_outlined, 'Status Ketersediaan'),

          const SizedBox(height: 8),

          SizedBox(
            height: 34,

            child: ListView(
              scrollDirection: Axis.horizontal,

              children: [
                _buildPillChip(
                  label: 'Semua',

                  count: totalStatus,

                  color: _kGreen,

                  selected: _statusFilter == null,

                  onTap: () {
                    setState(() {
                      _statusFilter = null;
                    });
                  },

                  showDot: false,
                ),

                for (final status in StockStatus.values)
                  if ((statusCounts[status] ?? 0) > 0)
                    _buildPillChip(
                      label: _statusLabel(status),

                      count: statusCounts[status]!,

                      color: _statusColor(status),

                      selected: _statusFilter == status,

                      onTap: () {
                        setState(() {
                          _statusFilter = status;
                        });
                      },
                    ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  // ===================================================================
  // FILTER LABEL
  // ===================================================================

  Widget _buildFilterLabel(IconData icon, String text) {
    return Row(
      children: [
        Icon(icon, size: 14, color: ObbelTheme.textLight),

        const SizedBox(width: 6),

        Text(
          text,

          style: const TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.w700,
            color: ObbelTheme.textLight,
            letterSpacing: 0.2,
          ),
        ),
      ],
    );
  }

  // ===================================================================
  // PILL CHIP
  // ===================================================================

  Widget _buildPillChip({
    required String label,
    required int count,
    required Color color,
    required bool selected,
    required VoidCallback onTap,
    bool showDot = true,
  }) {
    return Padding(
      padding: const EdgeInsets.only(right: 8),

      child: Material(
        color: selected ? color : ObbelTheme.backgroundLight,

        shape: StadiumBorder(
          side: BorderSide(color: selected ? color : Colors.grey.shade300),
        ),

        child: InkWell(
          customBorder: const StadiumBorder(),

          onTap: onTap,

          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),

            child: Row(
              mainAxisSize: MainAxisSize.min,

              children: [
                if (selected) ...[
                  const Icon(Icons.check, size: 14, color: Colors.white),

                  const SizedBox(width: 4),
                ] else if (showDot) ...[
                  Container(
                    width: 7,
                    height: 7,

                    decoration: BoxDecoration(
                      color: color,
                      shape: BoxShape.circle,
                    ),
                  ),

                  const SizedBox(width: 6),
                ],

                Text(
                  '$label ($count)',

                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w700,

                    color: selected ? Colors.white : ObbelTheme.textDark,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  // ===================================================================
  // SECTION HEADER
  // ===================================================================

  Widget _buildSectionHeader(int count) {
    final status = _statusFilter;

    String title = 'Daftar Stok Produk';

    String? trailing;

    if (status != null) {
      title = 'Stok Status: ${_statusLabel(status)}';

      trailing = '$count Item';
    } else if (_categoryFilter != 'Semua') {
      trailing = '$count Item';
    } else if (_searchQuery.trim().isNotEmpty) {
      trailing = '$count Item';
    }

    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,

      children: [
        Text(
          title,

          style: const TextStyle(
            fontSize: 15,
            fontWeight: FontWeight.w800,
            color: ObbelTheme.textDark,
          ),
        ),

        if (trailing != null)
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),

            decoration: BoxDecoration(
              color: (status != null ? _statusColor(status) : _kGreen)
                  .withValues(alpha: 0.12),

              borderRadius: BorderRadius.circular(20),
            ),

            child: Text(
              trailing,

              style: TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w700,

                color: status != null ? _statusColor(status) : _kGreen,
              ),
            ),
          ),
      ],
    );
  }

  // ===================================================================
  // EMPTY STATE
  // ===================================================================

  Widget _buildEmptyState() {
    final hasSearch = _searchQuery.trim().isNotEmpty;

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 40),

      child: Column(
        children: [
          Icon(
            hasSearch ? Icons.search_off : Icons.inventory_2_outlined,
            size: 40,
            color: Colors.grey.shade400,
          ),

          const SizedBox(height: 8),

          Text(
            hasSearch
                ? 'Produk tidak ditemukan.'
                : widget.pickForRestock
                ? 'Semua produk sudah ada di pengajuan.'
                : 'Tidak ada produk pada filter ini.',

            style: const TextStyle(color: ObbelTheme.textLight),
          ),

          if (hasSearch) ...[
            const SizedBox(height: 4),

            Text(
              'Coba cari berdasarkan nama atau SKU.',
              style: TextStyle(fontSize: 11, color: Colors.grey.shade500),
            ),
          ],
        ],
      ),
    );
  }

  // ===================================================================
  // PRODUCT CARD
  // ===================================================================

  Widget _buildProductCard(DummyStockItem item) {
    final color = _statusColor(item.status);

    final isAman = item.status == StockStatus.aman;

    final isSelected = _selectedIds.contains(item.id);

    final quickAdd = _quickAddFor(item);

    return GestureDetector(
      onTap: () {
        _toggleSelected(item.id);
      },

      child: Container(
        padding: const EdgeInsets.all(14),

        decoration: BoxDecoration(
          color: Colors.white,

          borderRadius: BorderRadius.circular(14),

          border: Border.all(
            color: isSelected ? _kGreen : _statusBorder(item.status),

            width: isSelected ? 1.6 : 1.2,
          ),

          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.02),

              blurRadius: 8,

              offset: const Offset(0, 3),
            ),
          ],
        ),

        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,

          children: [
            // =========================================================
            // HEADER PRODUK
            // =========================================================
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,

              children: [
                Container(
                  padding: const EdgeInsets.all(8),

                  decoration: BoxDecoration(
                    color: _statusBg(item.status),

                    borderRadius: BorderRadius.circular(10),
                  ),

                  child: Icon(
                    _categoryIcon(item.category),

                    color: color,

                    size: 18,
                  ),
                ),

                const SizedBox(width: 10),

                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,

                    children: [
                      Text(
                        item.name,

                        style: const TextStyle(
                          fontFamily: 'Outfit',

                          fontWeight: FontWeight.w800,

                          fontSize: 14,

                          color: ObbelTheme.textDark,
                        ),
                      ),

                      const SizedBox(height: 2),

                      Text(
                        'SKU: ${item.sku}',

                        style: const TextStyle(
                          fontSize: 11,

                          color: ObbelTheme.textLight,
                        ),
                      ),

                      const SizedBox(height: 6),

                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 8,
                          vertical: 3,
                        ),

                        decoration: BoxDecoration(
                          color: _statusBg(item.status),

                          borderRadius: BorderRadius.circular(6),
                        ),

                        child: Text(
                          _statusLabel(item.status),

                          style: TextStyle(
                            fontSize: 10,

                            fontWeight: FontWeight.w700,

                            color: color,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),

                const SizedBox(width: 8),

                Column(
                  crossAxisAlignment: CrossAxisAlignment.end,

                  children: [
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.baseline,

                      textBaseline: TextBaseline.alphabetic,

                      children: [
                        Text(
                          '${item.qty}',

                          style: const TextStyle(
                            fontFamily: 'Outfit',

                            fontSize: 20,

                            fontWeight: FontWeight.w900,

                            color: ObbelTheme.textDark,
                          ),
                        ),

                        const SizedBox(width: 3),

                        Text(
                          item.unit,

                          style: const TextStyle(
                            fontSize: 11,

                            color: ObbelTheme.textLight,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ],
            ),

            const SizedBox(height: 8),

            // =========================================================
            // TERAKHIR UPDATE
            // =========================================================
            Text(
              'Terakhir update: '
              '${_timeLabel(item.lastUpdate)}',

              style: TextStyle(fontSize: 10, color: Colors.grey.shade500),
            ),

            // =========================================================
            // MODE PILIH PRODUK (dari "Tambah Produk Lain ke Pengajuan")
            // =========================================================
            if (widget.pickForRestock) ...[
              const SizedBox(height: 10),

              Row(
                children: [
                  Icon(
                    isSelected
                        ? Icons.check_circle
                        : Icons.radio_button_unchecked,
                    size: 18,
                    color: isSelected ? _kGreen : Colors.grey.shade400,
                  ),
                  const SizedBox(width: 6),
                  Text(
                    isSelected
                        ? 'Dipilih untuk ditambahkan'
                        : 'Tap kartu untuk memilih',
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w600,
                      color: isSelected ? _kGreen : ObbelTheme.textLight,
                    ),
                  ),
                ],
              ),
            ]
            // =========================================================
            // RESTOCK (mode normal, bukan sedang memilih produk)
            // =========================================================
            else if (!isAman) ...[
              const SizedBox(height: 10),

              Row(
                crossAxisAlignment: CrossAxisAlignment.start,

                children: [
                  Text(
                    item.isRawMaterial ? 'Pilih Kuantitas:' : 'Tambah Cepat:',

                    style: const TextStyle(
                      fontSize: 11,

                      fontWeight: FontWeight.w600,

                      color: ObbelTheme.textLight,
                    ),
                  ),

                  const SizedBox(width: 8),

                  Expanded(
                    child: Wrap(
                      spacing: 6,
                      runSpacing: 6,

                      children: [
                        for (final option in item.quickAddOptions)
                          _buildQuickAddChip(item, option, quickAdd == option),
                      ],
                    ),
                  ),
                ],
              ),

              const SizedBox(height: 10),

              // =======================================================
              // TOMBOL AJUKAN RESTOCK
              // =======================================================
              SizedBox(
                width: double.infinity,

                child: ElevatedButton.icon(
                  onPressed: () {
                    _openRestockDetail(item);
                  },

                  style: ElevatedButton.styleFrom(
                    backgroundColor: _kGreen,

                    foregroundColor: Colors.white,

                    padding: const EdgeInsets.symmetric(vertical: 11),

                    elevation: 0,

                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(10),
                    ),
                  ),

                  icon: const Icon(
                    Icons.shopping_cart_outlined,

                    size: 16,

                    color: Colors.white,
                  ),

                  label: const Text(
                    'Ajukan Restock',

                    style: TextStyle(
                      fontSize: 12,

                      fontWeight: FontWeight.w800,

                      color: Colors.white,
                    ),
                  ),
                ),
              ),
            ]
            // =========================================================
            // JIKA AMAN
            // =========================================================
            else if (item.id == 'scl') ...[
              const SizedBox(height: 8),
            ],
          ],
        ),
      ),
    );
  }

  // ===================================================================
  // QUICK ADD CHIP
  // ===================================================================

  Widget _buildQuickAddChip(DummyStockItem item, int value, bool selected) {
    return GestureDetector(
      onTap: () {
        setState(() {
          _quickAddSelection[item.id] = value;
        });
      },

      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),

        decoration: BoxDecoration(
          color: selected ? _kGreen : ObbelTheme.backgroundLight,

          borderRadius: BorderRadius.circular(8),

          border: Border.all(
            color: selected ? Colors.transparent : Colors.grey.shade300,
          ),
        ),

        child: Text(
          '+$value',

          style: TextStyle(
            fontSize: 12,

            fontWeight: FontWeight.bold,

            color: selected ? Colors.white : ObbelTheme.textDark,
          ),
        ),
      ),
    );
  }

  // ===================================================================
  // HELP CARD
  // ===================================================================

  Widget _buildHelpCard() {
    return Container(
      width: double.infinity,

      padding: const EdgeInsets.all(16),

      decoration: BoxDecoration(
        color: Colors.white,

        borderRadius: BorderRadius.circular(14),

        border: Border.all(color: Colors.grey.shade200, width: 1.2),
      ),

      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,

        children: [
          const Text(
            'Pusat Bantuan Logistik Booth',

            style: TextStyle(
              fontWeight: FontWeight.bold,

              fontSize: 13,

              color: ObbelTheme.textDark,
            ),
          ),

          const SizedBox(height: 4),

          const Text(
            'Ada selisih bahan fisik atau kemasan bocor? '
            'Laporkan penyesuaian stok manual segera.',

            style: TextStyle(
              fontSize: 12,

              color: ObbelTheme.textLight,

              height: 1.4,
            ),
          ),

          const SizedBox(height: 12),

          SizedBox(
            width: double.infinity,

            child: OutlinedButton.icon(
              style: OutlinedButton.styleFrom(
                padding: const EdgeInsets.symmetric(vertical: 12),

                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(10),
                ),

                side: BorderSide(color: Colors.grey.shade300),
              ),

              onPressed: () {
                Navigator.push(
                  context,
                  MaterialPageRoute(builder: (_) => const StockHistoryScreen()),
                );
              },

              icon: const Icon(
                Icons.history,

                size: 16,

                color: ObbelTheme.textDark,
              ),

              label: const Text(
                'Riwayat Stok',

                style: TextStyle(
                  color: ObbelTheme.textDark,

                  fontWeight: FontWeight.bold,

                  fontSize: 12,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  // ===================================================================
  // SELECTION BAR
  // ===================================================================

  Widget _buildSelectionBar() {
    return Container(
      margin: const EdgeInsets.fromLTRB(16, 0, 16, 12),

      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),

      decoration: BoxDecoration(
        color: _kGreen,

        borderRadius: BorderRadius.circular(30),

        boxShadow: [
          BoxShadow(
            color: _kGreen.withValues(alpha: 0.3),

            blurRadius: 12,

            offset: const Offset(0, 4),
          ),
        ],
      ),

      child: Row(
        children: [
          const Icon(Icons.shopping_cart, color: Colors.white, size: 18),

          const SizedBox(width: 8),

          Expanded(
            child: Text(
              '${_selectedIds.length} Item Terpilih',

              style: const TextStyle(
                color: Colors.white,

                fontWeight: FontWeight.bold,

                fontSize: 13,
              ),
            ),
          ),

          Material(
            color: Colors.white,

            borderRadius: BorderRadius.circular(20),

            child: InkWell(
              borderRadius: BorderRadius.circular(20),

              onTap: widget.pickForRestock
                  ? _confirmPick
                  : _openBulkRestockDetail,

              child: Padding(
                padding: const EdgeInsets.symmetric(
                  horizontal: 14,
                  vertical: 8,
                ),

                child: Row(
                  mainAxisSize: MainAxisSize.min,

                  children: [
                    Text(
                      widget.pickForRestock ? 'Tambahkan' : 'Pengajuan',

                      style: const TextStyle(
                        color: _kGreen,

                        fontWeight: FontWeight.bold,

                        fontSize: 12,
                      ),
                    ),

                    const SizedBox(width: 4),

                    Icon(
                      widget.pickForRestock ? Icons.check : Icons.arrow_forward,

                      size: 14,

                      color: _kGreen,
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
