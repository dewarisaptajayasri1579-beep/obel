import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/theme/app_colors.dart';
import '../../core/utils/formatters.dart';
import '../../data/repositories/app_data_controller.dart';
import '../../shared/models/shift_summary.dart';

class ShiftScreen extends ConsumerWidget {
  const ShiftScreen({super.key});

  void _confirmReturnStock(BuildContext context, WidgetRef ref) {
    final stock = ref.read(appDataProvider).boothStock;
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Kembalikan Stok'),
        content: SizedBox(
          width: double.maxFinite,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'Sisa stok berikut akan diajukan sebagai return ke Gudang Pusat:',
              ),
              const SizedBox(height: 12),
              ...stock.where((s) => s.qtyOnHand > 0).map(
                    (s) => Padding(
                      padding: const EdgeInsets.symmetric(vertical: 3),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text(s.product.name),
                          Text(formatCup(s.qtyOnHand)),
                        ],
                      ),
                    ),
                  ),
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: const Text('Batal'),
          ),
          ElevatedButton(
            onPressed: () {
              Navigator.of(context).pop();
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(
                  content:
                      Text('Return diajukan, menunggu Admin menerima.'),
                ),
              );
            },
            child: const Text('Ajukan'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final data = ref.watch(appDataProvider);
    final shift = data.shift;
    final topStock = [...data.boothStock]
      ..sort((a, b) => b.qtyOnHand.compareTo(a.qtyOnHand));
    final topSelling = [...data.boothStock]
      ..sort((a, b) => b.qtyOnHand.compareTo(a.qtyOnHand));
    final isClosed = shift.status == ShiftStatus.closed;

    return Scaffold(
      appBar: AppBar(title: const Text('Ringkasan Shift')),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(20, 8, 20, 20),
        children: [
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: isClosed ? AppColors.textSecondary : AppColors.primary,
              borderRadius: BorderRadius.circular(16),
            ),
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        isClosed ? 'SHIFT 1 SELESAI' : 'SHIFT 1 AKTIF',
                        style: const TextStyle(
                          color: Colors.white,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        '${formatClock(shift.startTime)} – ${formatClock(shift.endTime)}',
                        style: const TextStyle(color: Colors.white70),
                      ),
                    ],
                  ),
                ),
                Icon(
                  isClosed ? Icons.check_circle_rounded : Icons.schedule_rounded,
                  color: Colors.white,
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(
                child: _StatBox(label: 'Omzet', value: formatRupiah(shift.omzetToday)),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: _StatBox(
                    label: 'Cup Terjual', value: formatCup(shift.cupSoldToday)),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: _StatBox(
                    label: 'Transaksi', value: '${shift.transactionCount}'),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: _StatBox(
                  label: 'Rata-rata / Transaksi',
                  value: formatRupiah(shift.averagePerTransaction),
                ),
              ),
            ],
          ),
          const SizedBox(height: 20),
          const Text('Stok Saat Ini',
              style: TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),
          const SizedBox(height: 8),
          for (final item in topStock.take(3))
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 4),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(item.product.name),
                  Text(
                    formatCup(item.qtyOnHand),
                    style: const TextStyle(fontWeight: FontWeight.w600),
                  ),
                ],
              ),
            ),
          const SizedBox(height: 20),
          const Text('Top Penjualan',
              style: TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),
          const SizedBox(height: 8),
          for (var i = 0; i < topSelling.take(3).length; i++)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 4),
              child: Row(
                children: [
                  Text('${i + 1}. ', style: const TextStyle(
                      color: AppColors.textSecondary, fontWeight: FontWeight.w600)),
                  Expanded(child: Text(topSelling[i].product.name)),
                  Text(formatCup(topSelling[i].qtyOnHand)),
                ],
              ),
            ),
          const SizedBox(height: 28),
          ElevatedButton.icon(
            onPressed: isClosed ? null : () => context.push('/closing-count'),
            icon: const Icon(Icons.verified_rounded),
            label: const Text('TUTUP SHIFT'),
          ),
          const SizedBox(height: 10),
          OutlinedButton.icon(
            onPressed: () => _confirmReturnStock(context, ref),
            style: OutlinedButton.styleFrom(
              foregroundColor: AppColors.accentOrange,
              side: const BorderSide(color: AppColors.accentOrange),
            ),
            icon: const Icon(Icons.inventory_2_outlined),
            label: const Text('KEMBALIKAN STOK'),
          ),
        ],
      ),
    );
  }
}

class _StatBox extends StatelessWidget {
  const _StatBox({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label,
              style: const TextStyle(
                  color: AppColors.textSecondary, fontSize: 12.5)),
          const SizedBox(height: 4),
          Text(
            value,
            style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16),
          ),
        ],
      ),
    );
  }
}
