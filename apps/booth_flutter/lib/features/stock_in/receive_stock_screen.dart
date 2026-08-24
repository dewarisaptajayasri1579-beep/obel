import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/theme/app_colors.dart';
import '../../core/utils/formatters.dart';
import '../../data/repositories/app_data_controller.dart';
import '../../shared/models/incoming_distribution.dart';
import '../../shared/widgets/quantity_stepper.dart';

class ReceiveStockScreen extends ConsumerStatefulWidget {
  const ReceiveStockScreen({super.key});

  @override
  ConsumerState<ReceiveStockScreen> createState() =>
      _ReceiveStockScreenState();
}

class _ReceiveStockScreenState extends ConsumerState<ReceiveStockScreen> {
  List<IncomingDistributionItem>? _items;

  List<IncomingDistributionItem> _itemsOrInit(IncomingDistribution dist) {
    return _items ??= [...dist.items];
  }

  int get _totalCup =>
      _items?.fold<int>(0, (sum, item) => sum + item.qtyReceived) ?? 0;

  void _updateQty(int index, int qty) {
    setState(() {
      _items![index] = _items![index].copyWith(qtyReceived: qty);
    });
  }

  void _confirmReceive() {
    ref.read(appDataProvider.notifier).receiveDistribution(_items!);
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('$_totalCup cup berhasil diterima.')),
    );
    context.pop();
  }

  void _reportDiscrepancy() {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Laporkan Selisih'),
        content: const Text(
          'Sesuaikan qty pada setiap item menggunakan +/- sebelum menekan '
          'Terima, lalu stok akan tercatat sesuai jumlah fisik yang diterima.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: const Text('Mengerti'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final dist = ref.watch(appDataProvider).pendingDistribution;
    if (dist == null) {
      return Scaffold(
        appBar: AppBar(title: const Text('Terima Stok')),
        body: const Center(child: Text('Tidak ada stok masuk.')),
      );
    }
    final items = _itemsOrInit(dist);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Stok Masuk\ndari Gudang Pusat'),
        titleTextStyle: const TextStyle(
          color: AppColors.textPrimary,
          fontSize: 15,
          fontWeight: FontWeight.w700,
          height: 1.3,
        ),
      ),
      body: Column(
        children: [
          Expanded(
            child: ListView(
              padding: const EdgeInsets.fromLTRB(20, 8, 20, 8),
              children: [
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: AppColors.background,
                    borderRadius: BorderRadius.circular(14),
                  ),
                  child: Column(
                    children: [
                      _InfoRow(label: 'Booth', value: dist.boothName),
                      _InfoRow(label: 'Shift', value: dist.shiftLabel),
                      _InfoRow(
                        label: 'Waktu Kirim',
                        value: formatDateTimeLabel(dist.sentAt),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 18),
                const Text(
                  'Daftar Stok Masuk',
                  style: TextStyle(fontWeight: FontWeight.w700, fontSize: 15),
                ),
                const SizedBox(height: 10),
                for (var i = 0; i < items.length; i++)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 10),
                    child: Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        border: Border.all(color: AppColors.border),
                        borderRadius: BorderRadius.circular(12),
                      ),
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
                                Text(
                                  items[i].product.name,
                                  style: const TextStyle(
                                      fontWeight: FontWeight.w600),
                                ),
                                Text(
                                  formatRupiah(items[i].product.sellPrice),
                                  style: const TextStyle(
                                    color: AppColors.textSecondary,
                                    fontSize: 12.5,
                                  ),
                                ),
                              ],
                            ),
                          ),
                          QuantityStepper(
                            value: items[i].qtyReceived,
                            max: items[i].qtySent + 20,
                            onChanged: (v) => _updateQty(i, v),
                          ),
                        ],
                      ),
                    ),
                  ),
              ],
            ),
          ),
          Container(
            padding: const EdgeInsets.fromLTRB(20, 14, 20, 20),
            decoration: const BoxDecoration(
              color: AppColors.surface,
              border: Border(top: BorderSide(color: AppColors.border)),
            ),
            child: SafeArea(
              top: false,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text('Total',
                          style: TextStyle(color: AppColors.textSecondary)),
                      Text(
                        formatCup(_totalCup),
                        style: const TextStyle(
                          fontWeight: FontWeight.w800,
                          fontSize: 18,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  ElevatedButton(
                    onPressed: _confirmReceive,
                    child: Text('TERIMA $_totalCup CUP'),
                  ),
                  const SizedBox(height: 8),
                  OutlinedButton(
                    onPressed: _reportDiscrepancy,
                    style: OutlinedButton.styleFrom(
                      foregroundColor: AppColors.critical,
                      side: const BorderSide(color: AppColors.critical),
                    ),
                    child: const Text('Tolak / Laporkan Selisih'),
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

class _InfoRow extends StatelessWidget {
  const _InfoRow({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label,
              style: const TextStyle(color: AppColors.textSecondary)),
          Text(value, style: const TextStyle(fontWeight: FontWeight.w600)),
        ],
      ),
    );
  }
}
