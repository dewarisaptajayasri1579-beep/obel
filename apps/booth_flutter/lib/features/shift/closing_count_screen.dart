import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/theme/app_colors.dart';
import '../../core/utils/formatters.dart';
import '../../data/repositories/app_data_controller.dart';
import '../../shared/widgets/quantity_stepper.dart';

const _reasonOptions = ['Tumpah', 'Rusak', 'Hilang', 'Lainnya'];

class ClosingCountScreen extends ConsumerStatefulWidget {
  const ClosingCountScreen({super.key});

  @override
  ConsumerState<ClosingCountScreen> createState() =>
      _ClosingCountScreenState();
}

class _ClosingCountScreenState extends ConsumerState<ClosingCountScreen> {
  late final Map<String, int> _actual = {
    for (final item in ref.read(appDataProvider).boothStock)
      item.product.id: item.qtyOnHand,
  };
  final Map<String, String?> _reason = {};

  bool get _canConfirm {
    final stock = ref.read(appDataProvider).boothStock;
    for (final item in stock) {
      final discrepancy = _actual[item.product.id]! - item.qtyOnHand;
      if (discrepancy != 0 && _reason[item.product.id] == null) return false;
    }
    return true;
  }

  void _confirm() {
    final stock = ref.read(appDataProvider).boothStock;
    final discrepantItems = stock
        .where((item) => _actual[item.product.id] != item.qtyOnHand)
        .toList();

    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Konfirmasi Closing'),
        content: SizedBox(
          width: double.maxFinite,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (discrepantItems.isEmpty)
                const Text('Semua stok sesuai expected. Tidak ada selisih.')
              else ...[
                const Text('Selisih ditemukan:'),
                const SizedBox(height: 8),
                for (final item in discrepantItems)
                  Padding(
                    padding: const EdgeInsets.symmetric(vertical: 3),
                    child: Text(
                      '${item.product.name}: ${item.qtyOnHand} → '
                      '${_actual[item.product.id]} '
                      '(${_reason[item.product.id]})',
                    ),
                  ),
              ],
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: const Text('Periksa Lagi'),
          ),
          ElevatedButton(
            onPressed: () {
              Navigator.of(context).pop();
              ref.read(appDataProvider.notifier).applyClosingCount(_actual);
              context.pop();
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('Shift berhasil ditutup.')),
              );
            },
            child: const Text('Konfirmasi Closing'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final stock = ref.watch(appDataProvider).boothStock;

    return Scaffold(
      appBar: AppBar(title: const Text('Hitung Stok Fisik')),
      body: Column(
        children: [
          Expanded(
            child: ListView.builder(
              padding: const EdgeInsets.fromLTRB(20, 8, 20, 8),
              itemCount: stock.length,
              itemBuilder: (context, index) {
                final item = stock[index];
                final actual = _actual[item.product.id]!;
                final discrepancy = actual - item.qtyOnHand;

                return Container(
                  margin: const EdgeInsets.only(bottom: 12),
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    border: Border.all(color: AppColors.border),
                    borderRadius: BorderRadius.circular(14),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(item.product.name,
                                    style: const TextStyle(
                                        fontWeight: FontWeight.w700)),
                                Text(
                                  'Expected ${formatCup(item.qtyOnHand)}',
                                  style: const TextStyle(
                                    color: AppColors.textSecondary,
                                    fontSize: 12.5,
                                  ),
                                ),
                              ],
                            ),
                          ),
                          QuantityStepper(
                            value: actual,
                            onChanged: (v) =>
                                setState(() => _actual[item.product.id] = v),
                          ),
                        ],
                      ),
                      if (discrepancy != 0) ...[
                        const SizedBox(height: 10),
                        Text(
                          discrepancy > 0
                              ? 'Selisih +$discrepancy cup'
                              : 'Selisih $discrepancy cup',
                          style: TextStyle(
                            fontWeight: FontWeight.w600,
                            color: discrepancy > 0
                                ? AppColors.info
                                : AppColors.critical,
                          ),
                        ),
                        const SizedBox(height: 8),
                        Wrap(
                          spacing: 8,
                          children: [
                            for (final reason in _reasonOptions)
                              ChoiceChip(
                                label: Text(reason),
                                selected: _reason[item.product.id] == reason,
                                onSelected: (_) => setState(
                                  () => _reason[item.product.id] = reason,
                                ),
                                selectedColor: AppColors.primary,
                                labelStyle: TextStyle(
                                  color: _reason[item.product.id] == reason
                                      ? Colors.white
                                      : AppColors.textPrimary,
                                  fontWeight: FontWeight.w600,
                                  fontSize: 12.5,
                                ),
                              ),
                          ],
                        ),
                      ],
                    ],
                  ),
                );
              },
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
              child: ElevatedButton(
                onPressed: _canConfirm ? _confirm : null,
                child: const Text('Konfirmasi'),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
