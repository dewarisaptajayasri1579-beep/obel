import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../api_client.dart';
import '../app_state.dart';
import '../theme.dart';
import '../dummy_stock.dart';
import 'stock_screen.dart';
import 'restock_success_screen.dart';

// ============================================================
// DUMMY DATA RESTOCK
// ============================================================

class DummyRestockItem {
  final String id;
  final String name;
  final String sku;
  final String unit;
  final String status;
  final String statusInfo;
  final int initialQuantity;
  final List<int> quickOptions;

  DummyRestockItem({
    required this.id,
    required this.name,
    required this.sku,
    required this.unit,
    required this.status,
    required this.statusInfo,
    required this.initialQuantity,
    required this.quickOptions,
  });
}

// ============================================================
// SCREEN
// ============================================================

class RestockDetailScreen extends StatefulWidget {
  // Semua produk yang dikirim dari StockScreen
  final List<DummyStockItem> items;

  // Jumlah awal masing-masing produk
  //
  // Contoh:
  // {
  //   'susu': 10,
  //   'gula': 5,
  //   'cup': 20,
  // }
  final Map<String, int>? initialQuantities;

  const RestockDetailScreen({
    super.key,
    required this.items,
    this.initialQuantities,
  });

  @override
  State<RestockDetailScreen> createState() => _RestockDetailScreenState();
}

// ============================================================
// STATE
// ============================================================

class _RestockDetailScreenState extends State<RestockDetailScreen> {
  // ==========================================================
  // DATA PRODUK
  // ==========================================================

  late List<DummyRestockItem> _items;

  // ==========================================================
  // QUANTITY
  // ==========================================================

  final Map<String, int> _quantities = {};

  // ==========================================================
  // INIT
  // ==========================================================

  @override
  void initState() {
    super.initState();

    // Ubah semua DummyStockItem menjadi
    // DummyRestockItem.
    _items = widget.items.map((stockItem) {
      return _toRestockItem(
        stockItem,
        initialQuantity: widget.initialQuantities?[stockItem.id],
      );
    }).toList();

    // Isi quantity awal setiap produk.
    for (final item in _items) {
      _quantities[item.id] = item.initialQuantity;
    }
  }

  // ==========================================================
  // KONVERSI DummyStockItem -> DummyRestockItem
  // ==========================================================

  // Dipakai baik saat layar ini pertama dibuka (initState) maupun
  // saat produk baru digabung dari "Tambah Produk Lain ke Pengajuan",
  // supaya keduanya konsisten satu sumber logika.
  DummyRestockItem _toRestockItem(
    DummyStockItem stockItem, {
    int? initialQuantity,
  }) {
    return DummyRestockItem(
      id: stockItem.id,
      name: stockItem.name,
      sku: stockItem.sku,
      unit: stockItem.unit,
      status: _statusLabel(stockItem.status),
      statusInfo: '${stockItem.qty} ${stockItem.unit} tersisa',
      // Prioritaskan jumlah yang dikirim dari StockScreen,
      // jika tidak ada pakai default quick-add produk itu.
      initialQuantity: initialQuantity ?? stockItem.defaultQuickAdd,
      quickOptions: stockItem.quickAddOptions,
    );
  }

  // ==========================================================
  // STATUS LABEL
  // ==========================================================

  String _statusLabel(StockStatus status) {
    switch (status) {
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

  // ==========================================================
  // TOTAL QUANTITY
  // ==========================================================

  int get _totalQuantity {
    return _quantities.values.fold(0, (total, value) => total + value);
  }

  // ==========================================================
  // UBAH QUANTITY
  // ==========================================================

  void _changeQuantity(DummyRestockItem item, int change) {
    setState(() {
      final current = _quantities[item.id] ?? 0;

      final newValue = current + change;

      if (newValue >= 0) {
        _quantities[item.id] = newValue;
      }
    });
  }

  // ==========================================================
  // SET QUANTITY
  // ==========================================================

  void _setQuantity(DummyRestockItem item, int value) {
    setState(() {
      _quantities[item.id] = value;
    });
  }

  // ==========================================================
  // RESET
  // ==========================================================

  void _resetQuantity() {
    setState(() {
      for (final item in _items) {
        _quantities[item.id] = item.initialQuantity;
      }
    });
  }

  // ==========================================================
  // DELETE PRODUCT
  // ==========================================================

  void _removeProduct(DummyRestockItem item) {
    setState(() {
      _items.removeWhere((element) => element.id == item.id);

      _quantities.remove(item.id);
    });
  }

  // ==========================================================
  // TAMBAH PRODUK LAIN KE PENGAJUAN (GABUNG KE DRAFT INI)
  // ==========================================================

  // Membuka StockScreen dalam mode "pilih produk" (pickForRestock).
  // Produk yang sudah ada di draft ini disembunyikan dari daftar
  // pilihan supaya tidak dobel. Saat StockScreen mengembalikan
  // (pop) daftar produk yang dipilih, produk-produk itu langsung
  // digabung ke `_items`/`_quantities` draft yang sedang berjalan —
  // jadi tetap satu pengajuan, bukan membuka halaman restock baru.
  Future<void> _addMoreProducts() async {
    final alreadyAddedIds = _items.map((item) => item.id).toSet();

    final result = await Navigator.push<List<DummyStockItem>>(
      context,
      MaterialPageRoute(
        builder: (_) =>
            StockScreen(pickForRestock: true, alreadyAddedIds: alreadyAddedIds),
      ),
    );

    if (!mounted) return;
    if (result == null || result.isEmpty) return;

    setState(() {
      for (final stockItem in result) {
        // Jaga-jaga terhadap duplikat.
        if (_quantities.containsKey(stockItem.id)) continue;

        final restockItem = _toRestockItem(stockItem);
        _items.add(restockItem);
        _quantities[restockItem.id] = restockItem.initialQuantity;
      }
    });

    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('${result.length} produk ditambahkan ke pengajuan ini.'),
        backgroundColor: ObbelTheme.primaryDark,
      ),
    );
  }

  // ==========================================================
  // KIRIM PENGAJUAN
  // ==========================================================

  Future<void> _submitRestock() async {
    if (_items.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Tidak ada produk dalam pengajuan.')),
      );

      return;
    }

    if (_totalQuantity <= 0) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Jumlah restock harus lebih dari 0.')),
      );

      return;
    }

    final now = DateTime.now();
    try {
      final requestId = await context.read<AppState>().submitRestock([
        for (final item in _items)
          if ((_quantities[item.id] ?? 0) > 0)
            {'productId': item.id, 'qty': _quantities[item.id] ?? 0},
      ]);

      if (!mounted) return;
      Navigator.pushReplacement(
        context,
        MaterialPageRoute(
          builder: (_) => RestockSuccessScreen(
            requestId: requestId,
            submittedAt: now,
            items: List<DummyRestockItem>.from(_items),
            quantities: Map<String, int>.from(_quantities),
          ),
        ),
      );
    } on ApiException catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(error.message)));
    }
  }

  // ==========================================================
  // BUILD
  // ==========================================================

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: ObbelTheme.backgroundLight,

      // ========================================================
      // APP BAR
      // ========================================================
      appBar: AppBar(
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),

          onPressed: () {
            Navigator.pop(context);
          },
        ),

        title: const Text('Konfirmasi Restock'),

        actions: [
          TextButton.icon(
            onPressed: _resetQuantity,

            icon: const Icon(Icons.refresh, size: 17, color: Colors.red),

            label: const Text(
              'Reset',

              style: TextStyle(
                color: Colors.red,
                fontSize: 12,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        ],
      ),

      // ========================================================
      // BODY
      // ========================================================
      body: Column(
        children: [
          Expanded(
            child: ListView(
              padding: const EdgeInsets.fromLTRB(16, 14, 16, 120),

              children: [
                // ==================================================
                // INFO CARD
                // ==================================================
                _buildInfoCard(),

                const SizedBox(height: 18),

                // ==================================================
                // HEADER DAFTAR PRODUK
                // ==================================================
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,

                  children: [
                    const Text(
                      'Daftar Produk',

                      style: TextStyle(
                        fontSize: 17,
                        fontWeight: FontWeight.w800,
                        color: ObbelTheme.textDark,
                      ),
                    ),

                    Text(
                      '${_items.length} Produk',

                      style: const TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                        color: ObbelTheme.textLight,
                      ),
                    ),
                  ],
                ),

                const SizedBox(height: 12),

                // ==================================================
                // PRODUCT CARDS
                // ==================================================
                if (_items.isEmpty)
                  _buildEmptyProductState()
                else
                  for (final item in _items) ...[
                    _buildProductCard(item),

                    const SizedBox(height: 12),
                  ],

                // ==================================================
                // TAMBAH PRODUK
                // ==================================================
                _buildAddProductButton(),
              ],
            ),
          ),

          // ======================================================
          // BOTTOM BUTTON
          // ======================================================
          _buildBottomButton(),
        ],
      ),
    );
  }

  // ============================================================
  // INFO CARD
  // ============================================================

  Widget _buildInfoCard() {
    return Container(
      padding: const EdgeInsets.all(14),

      decoration: BoxDecoration(
        color: const Color(0xFFF1F5FF),

        borderRadius: BorderRadius.circular(14),

        border: Border.all(color: const Color(0xFFD8E1F0)),
      ),

      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,

        children: [
          Container(
            padding: const EdgeInsets.all(8),

            decoration: BoxDecoration(
              color: const Color(0xFFDCEFE7),

              borderRadius: BorderRadius.circular(8),
            ),

            child: const Icon(
              Icons.fact_check_outlined,

              color: ObbelTheme.primaryDark,

              size: 21,
            ),
          ),

          const SizedBox(width: 12),

          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,

              children: [
                const Text(
                  'Periksa Kembali Pengajuan',

                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w800,
                    color: ObbelTheme.primaryDark,
                  ),
                ),

                const SizedBox(height: 4),

                Text(
                  'Pastikan kuantitas draft restock '
                  'telah sesuai estimasi penjualan shift '
                  'agar operasional booth berjalan lancar.',

                  style: TextStyle(
                    fontSize: 11,
                    color: Colors.grey.shade700,
                    height: 1.35,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  // ============================================================
  // EMPTY PRODUCT STATE
  // ============================================================

  Widget _buildEmptyProductState() {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 30),

      alignment: Alignment.center,

      child: Column(
        children: [
          Icon(
            Icons.inventory_2_outlined,
            size: 40,
            color: Colors.grey.shade400,
          ),

          const SizedBox(height: 8),

          const Text(
            'Tidak ada produk dalam pengajuan.',

            style: TextStyle(fontSize: 12, color: ObbelTheme.textLight),
          ),
        ],
      ),
    );
  }

  // ============================================================
  // PRODUCT CARD
  // ============================================================

  Widget _buildProductCard(DummyRestockItem item) {
    final quantity = _quantities[item.id] ?? 0;

    final statusColor = _getStatusColor(item.status);

    final statusBackground = _getStatusBackground(item.status);

    return Container(
      padding: const EdgeInsets.fromLTRB(14, 14, 14, 12),

      decoration: BoxDecoration(
        color: Colors.white,

        borderRadius: BorderRadius.circular(14),

        border: Border.all(
          color: statusColor.withValues(alpha: 0.35),

          width: 1.2,
        ),
      ),

      child: Column(
        children: [
          // ======================================================
          // HEADER PRODUCT
          // ======================================================
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,

            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,

                  children: [
                    // STATUS + SKU
                    Row(
                      children: [
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 8,
                            vertical: 4,
                          ),

                          decoration: BoxDecoration(
                            color: statusBackground,

                            borderRadius: BorderRadius.circular(6),
                          ),

                          child: Text(
                            item.status,

                            style: TextStyle(
                              fontSize: 10,
                              fontWeight: FontWeight.w700,
                              color: statusColor,
                            ),
                          ),
                        ),

                        const SizedBox(width: 8),

                        Flexible(
                          child: Text(
                            'SKU: ${item.sku}',

                            overflow: TextOverflow.ellipsis,

                            style: const TextStyle(
                              fontSize: 10,
                              color: ObbelTheme.textLight,
                            ),
                          ),
                        ),
                      ],
                    ),

                    const SizedBox(height: 7),

                    // NAMA PRODUK
                    Text(
                      item.name,

                      style: const TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w800,
                        color: ObbelTheme.textDark,
                      ),
                    ),

                    const SizedBox(height: 3),

                    // SATUAN
                    Text(
                      'Satuan: ${item.unit}',

                      style: const TextStyle(
                        fontSize: 10,
                        color: ObbelTheme.textLight,
                      ),
                    ),

                    const SizedBox(height: 3),

                    // STOK TERSISA
                    Text(
                      item.statusInfo,

                      style: const TextStyle(
                        fontSize: 10,
                        color: ObbelTheme.textLight,
                      ),
                    ),
                  ],
                ),
              ),

              const SizedBox(width: 8),

              // ==================================================
              // DELETE
              // ==================================================
              IconButton(
                onPressed: () {
                  _removeProduct(item);
                },

                padding: EdgeInsets.zero,

                constraints: const BoxConstraints(),

                icon: Icon(
                  Icons.delete_outline,
                  size: 20,
                  color: Colors.grey.shade600,
                ),
              ),
            ],
          ),

          const SizedBox(height: 12),

          Divider(height: 1, color: Colors.grey.shade200),

          const SizedBox(height: 12),

          // ======================================================
          // JUMLAH DIAJUKAN
          // ======================================================
          Row(
            children: [
              const Expanded(
                child: Text(
                  'Jumlah Diajukan:',

                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w500,
                    color: ObbelTheme.textDark,
                  ),
                ),
              ),

              _buildQuantityControl(item, quantity),
            ],
          ),

          const SizedBox(height: 12),

          // ======================================================
          // OPSI CEPAT
          // ======================================================
          Row(
            crossAxisAlignment: CrossAxisAlignment.center,

            children: [
              const Text(
                'Opsi cepat:',

                style: TextStyle(fontSize: 10, color: ObbelTheme.textLight),
              ),

              const SizedBox(width: 10),

              Expanded(
                child: Wrap(
                  spacing: 7,
                  runSpacing: 7,

                  children: [
                    for (final option in item.quickOptions)
                      _buildQuickOption(item, option, quantity == option),
                  ],
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  // ============================================================
  // QUANTITY CONTROL
  // ============================================================

  Widget _buildQuantityControl(DummyRestockItem item, int quantity) {
    return Container(
      padding: const EdgeInsets.all(4),

      decoration: BoxDecoration(
        color: const Color(0xFFF1F5F8),

        borderRadius: BorderRadius.circular(10),

        border: Border.all(color: const Color(0xFFDCE3EA)),
      ),

      child: Row(
        mainAxisSize: MainAxisSize.min,

        children: [
          // ====================================================
          // MINUS
          // ====================================================
          Material(
            color: Colors.white,

            borderRadius: BorderRadius.circular(7),

            child: InkWell(
              borderRadius: BorderRadius.circular(7),

              onTap: quantity > 0
                  ? () {
                      _changeQuantity(item, -1);
                    }
                  : null,

              child: SizedBox(
                width: 44,
                height: 42,

                child: Center(
                  child: Text(
                    '−',

                    style: TextStyle(
                      fontSize: 22,
                      fontWeight: FontWeight.w600,

                      color: quantity > 0
                          ? ObbelTheme.primaryDark
                          : Colors.grey,
                    ),
                  ),
                ),
              ),
            ),
          ),

          // ====================================================
          // NUMBER
          // ====================================================
          SizedBox(
            width: 52,

            child: Center(
              child: Text(
                '+$quantity',

                style: const TextStyle(
                  fontSize: 17,
                  fontWeight: FontWeight.w900,
                  color: ObbelTheme.primaryDark,
                ),
              ),
            ),
          ),

          // ====================================================
          // PLUS
          // ====================================================
          Material(
            color: ObbelTheme.primaryDark,

            borderRadius: BorderRadius.circular(7),

            child: InkWell(
              borderRadius: BorderRadius.circular(7),

              onTap: () {
                _changeQuantity(item, 1);
              },

              child: const SizedBox(
                width: 44,
                height: 42,

                child: Center(
                  child: Icon(Icons.add, color: Colors.white, size: 21),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  // ============================================================
  // QUICK OPTION
  // ============================================================

  Widget _buildQuickOption(DummyRestockItem item, int value, bool selected) {
    return GestureDetector(
      onTap: () {
        _setQuantity(item, value);
      },

      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 6),

        decoration: BoxDecoration(
          color: selected ? ObbelTheme.primaryDark : const Color(0xFFF7F8FA),

          borderRadius: BorderRadius.circular(7),

          border: Border.all(
            color: selected ? ObbelTheme.primaryDark : Colors.grey.shade300,
          ),
        ),

        child: Text(
          '+$value${selected ? ' ' : ''}',

          style: TextStyle(
            fontSize: 10,
            fontWeight: FontWeight.w700,

            color: selected ? Colors.white : ObbelTheme.textDark,
          ),
        ),
      ),
    );
  }

  // ============================================================
  // ADD PRODUCT
  // ============================================================

  Widget _buildAddProductButton() {
    return SizedBox(
      width: double.infinity,

      child: OutlinedButton.icon(
        onPressed: _addMoreProducts,

        style: OutlinedButton.styleFrom(
          padding: const EdgeInsets.symmetric(vertical: 13),

          side: BorderSide(color: Colors.grey.shade400, width: 1.2),

          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(10),
          ),
        ),

        icon: const Icon(
          Icons.add_circle_outline,
          size: 18,
          color: ObbelTheme.primaryDark,
        ),

        label: const Text(
          'Tambah Produk Lain ke Pengajuan',

          style: TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.w700,
            color: ObbelTheme.primaryDark,
          ),
        ),
      ),
    );
  }

  // ============================================================
  // BOTTOM BUTTON
  // ============================================================

  Widget _buildBottomButton() {
    final disabled = _items.isEmpty || _totalQuantity <= 0;

    return Container(
      padding: const EdgeInsets.fromLTRB(16, 10, 16, 12),

      decoration: BoxDecoration(
        color: Colors.white,

        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.08),

            blurRadius: 10,

            offset: const Offset(0, -3),
          ),
        ],
      ),

      child: SizedBox(
        width: double.infinity,

        child: ElevatedButton.icon(
          onPressed: disabled ? null : _submitRestock,

          style: ElevatedButton.styleFrom(
            backgroundColor: ObbelTheme.primaryDark,

            disabledBackgroundColor: Colors.grey.shade300,

            padding: const EdgeInsets.symmetric(vertical: 14),

            elevation: 0,

            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(11),
            ),
          ),

          icon: Icon(
            Icons.send_outlined,

            color: disabled ? Colors.grey.shade500 : Colors.white,

            size: 18,
          ),

          label: Text(
            'Kirim Pengajuan Restock '
            '($_totalQuantity Unit)',

            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w800,

              color: disabled ? Colors.grey.shade500 : Colors.white,
            ),
          ),
        ),
      ),
    );
  }

  // ============================================================
  // STATUS COLOR
  // ============================================================

  Color _getStatusColor(String status) {
    switch (status) {
      case 'Habis':
        return Colors.red.shade600;

      case 'Kritis':
        return Colors.orange.shade800;

      case 'Menipis':
        return Colors.amber.shade800;

      case 'Aman':
        return Colors.green.shade700;

      default:
        return ObbelTheme.primaryDark;
    }
  }

  // ============================================================
  // STATUS BACKGROUND
  // ============================================================

  Color _getStatusBackground(String status) {
    return _getStatusColor(status).withValues(alpha: 0.12);
  }
}
