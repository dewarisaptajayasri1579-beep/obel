import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/theme/app_colors.dart';
import '../../core/utils/formatters.dart';
import '../../data/repositories/app_data_controller.dart';
import '../../shared/models/booth_stock_item.dart';
import '../../shared/models/stock_status.dart';
import '../../shared/widgets/quantity_stepper.dart';
import '../../shared/widgets/status_badge.dart';

class StockScreen extends ConsumerStatefulWidget {
  const StockScreen({super.key});

  @override
  ConsumerState<StockScreen> createState() => _StockScreenState();
}

class _StockScreenState extends ConsumerState<StockScreen> {
  String _query = '';
  StockStatus? _filter;

  void _openRestockSheet(BuildContext context, List<BoothStockItem> stock) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (context) => _RestockRequestSheet(stock: stock),
    );
  }

  @override
  Widget build(BuildContext context) {
    final data = ref.watch(appDataProvider);
    final filtered = data.boothStock
        .where((item) => _filter == null || item.status == _filter)
        .where((item) => _query.isEmpty ||
            item.product.name.toLowerCase().contains(_query.toLowerCase()))
        .toList();

    return Scaffold(
      appBar: AppBar(
        title: const Text('Stok Booth'),
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 4, 16, 8),
            child: TextField(
              onChanged: (v) => setState(() => _query = v),
              decoration: const InputDecoration(
                hintText: 'Cari produk...',
                prefixIcon: Icon(Icons.search_rounded),
              ),
            ),
          ),
          SizedBox(
            height: 40,
            child: ListView(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 16),
              children: [
                _FilterChip(
                  label: 'Semua',
                  selected: _filter == null,
                  onTap: () => setState(() => _filter = null),
                ),
                for (final s in StockStatus.values)
                  Padding(
                    padding: const EdgeInsets.only(left: 8),
                    child: _FilterChip(
                      label: s.label,
                      selected: _filter == s,
                      onTap: () => setState(() => _filter = s),
                    ),
                  ),
              ],
            ),
          ),
          const SizedBox(height: 4),
          Expanded(
            child: ListView.separated(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
              itemCount: filtered.length,
              separatorBuilder: (_, _) => const Divider(height: 1),
              itemBuilder: (context, index) {
                final item = filtered[index];
                return Padding(
                  padding: const EdgeInsets.symmetric(vertical: 10),
                  child: Row(
                    children: [
                      Container(
                        width: 36,
                        height: 36,
                        decoration: BoxDecoration(
                          color: AppColors.primaryLight,
                          borderRadius: BorderRadius.circular(10),
                        ),
                        child: const Icon(Icons.local_cafe_outlined,
                            color: AppColors.primary, size: 18),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(item.product.name,
                                style:
                                    const TextStyle(fontWeight: FontWeight.w600)),
                            Text(
                              'Stok ${formatCup(item.qtyOnHand)}',
                              style: const TextStyle(
                                color: AppColors.textSecondary,
                                fontSize: 12.5,
                              ),
                            ),
                          ],
                        ),
                      ),
                      StatusBadge(
                        label: item.status.label,
                        color: item.status.color,
                      ),
                    ],
                  ),
                );
              },
            ),
          ),
          Container(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 16),
            decoration: const BoxDecoration(
              color: AppColors.surface,
              border: Border(top: BorderSide(color: AppColors.border)),
            ),
            child: SafeArea(
              top: false,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  ElevatedButton.icon(
                    onPressed: () => _openRestockSheet(context, data.boothStock),
                    icon: const Icon(Icons.add_shopping_cart_rounded),
                    label: const Text('MINTA RESTOCK'),
                  ),
                  const SizedBox(height: 8),
                  OutlinedButton(
                    onPressed: () {
                      showDialog(
                        context: context,
                        builder: (context) => AlertDialog(
                          title: const Text('Riwayat Stok'),
                          content: const Text(
                            'Riwayat pergerakan stok akan tersedia setelah '
                            'Backend API dan ledger stock_movements terhubung.',
                          ),
                          actions: [
                            TextButton(
                              onPressed: () => Navigator.of(context).pop(),
                              child: const Text('Tutup'),
                            ),
                          ],
                        ),
                      );
                    },
                    child: const Text('RIWAYAT STOK'),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _FilterChip extends StatelessWidget {
  const _FilterChip({
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return ChoiceChip(
      label: Text(label),
      selected: selected,
      onSelected: (_) => onTap(),
      selectedColor: AppColors.primary,
      labelStyle: TextStyle(
        color: selected ? Colors.white : AppColors.textPrimary,
        fontWeight: FontWeight.w600,
      ),
      backgroundColor: AppColors.background,
      side: BorderSide(color: selected ? AppColors.primary : AppColors.border),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(999)),
    );
  }
}

class _RestockRequestSheet extends ConsumerStatefulWidget {
  const _RestockRequestSheet({required this.stock});

  final List<BoothStockItem> stock;

  @override
  ConsumerState<_RestockRequestSheet> createState() =>
      _RestockRequestSheetState();
}

class _RestockRequestSheetState extends ConsumerState<_RestockRequestSheet> {
  late BoothStockItem _selected = widget.stock.first;
  int _qty = 10;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.fromLTRB(
        20,
        20,
        20,
        20 + MediaQuery.of(context).viewInsets.bottom,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const Text(
            'Minta Restock',
            style: TextStyle(fontSize: 17, fontWeight: FontWeight.w700),
          ),
          const SizedBox(height: 16),
          const Text('Produk', style: TextStyle(color: AppColors.textSecondary)),
          const SizedBox(height: 6),
          SizedBox(
            height: 40,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              itemCount: widget.stock.length,
              separatorBuilder: (_, _) => const SizedBox(width: 8),
              itemBuilder: (context, index) {
                final item = widget.stock[index];
                final selected = item.product.id == _selected.product.id;
                return ChoiceChip(
                  label: Text(item.product.name),
                  selected: selected,
                  onSelected: (_) => setState(() => _selected = item),
                  selectedColor: AppColors.primary,
                  labelStyle: TextStyle(
                    color: selected ? Colors.white : AppColors.textPrimary,
                    fontWeight: FontWeight.w600,
                  ),
                );
              },
            ),
          ),
          const SizedBox(height: 16),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text('Jumlah', style: TextStyle(color: AppColors.textSecondary)),
              QuantityStepper(
                value: _qty,
                min: 1,
                onChanged: (v) => setState(() => _qty = v),
              ),
            ],
          ),
          const SizedBox(height: 10),
          QuickQtyRow(onPick: (v) => setState(() => _qty = v)),
          const SizedBox(height: 20),
          ElevatedButton(
            onPressed: () {
              Navigator.of(context).pop();
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(
                  content: Text(
                    'Permintaan restock ${_selected.product.name} $_qty cup terkirim.',
                  ),
                ),
              );
            },
            child: const Text('Kirim Permintaan'),
          ),
        ],
      ),
    );
  }
}
