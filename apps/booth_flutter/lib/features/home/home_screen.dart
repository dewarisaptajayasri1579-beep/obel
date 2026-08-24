import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/theme/app_colors.dart';
import '../../core/utils/formatters.dart';
import '../../data/repositories/app_data_controller.dart';
import '../../shared/models/stock_status.dart';
import '../../shared/widgets/kpi_tile.dart';

class HomeScreen extends ConsumerWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final data = ref.watch(appDataProvider);
    final shift = data.shift;
    final lowStockCount = data.boothStock
        .where((item) => item.status != StockStatus.aman)
        .length;

    return SafeArea(
      child: ListView(
        padding: const EdgeInsets.fromLTRB(20, 16, 20, 24),
        children: [
          Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'Selamat pagi,',
                      style: TextStyle(
                        color: AppColors.textSecondary,
                        fontSize: 13,
                      ),
                    ),
                    Text(
                      '${data.staffName} 👋',
                      style: const TextStyle(
                        fontSize: 20,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ],
                ),
              ),
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: AppColors.surface,
                  shape: BoxShape.circle,
                  border: Border.all(color: AppColors.border),
                ),
                child: const Icon(
                  Icons.notifications_none_rounded,
                  color: AppColors.textPrimary,
                ),
              ),
            ],
          ),
          const SizedBox(height: 20),
          Container(
            padding: const EdgeInsets.all(18),
            decoration: BoxDecoration(
              color: AppColors.primary,
              borderRadius: BorderRadius.circular(18),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  data.boothName,
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 15,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: 10),
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.16),
                    borderRadius: BorderRadius.circular(999),
                  ),
                  child: Text(
                    'SHIFT 1 AKTIF',
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 11,
                      fontWeight: FontWeight.w700,
                      letterSpacing: 0.4,
                    ),
                  ),
                ),
                const SizedBox(height: 8),
                Row(
                  children: [
                    const Icon(Icons.schedule_rounded,
                        color: Colors.white70, size: 16),
                    const SizedBox(width: 6),
                    Text(
                      '${formatClock(shift.startTime)} – ${formatClock(shift.endTime)}',
                      style: const TextStyle(color: Colors.white70),
                    ),
                  ],
                ),
              ],
            ),
          ),
          if (data.pendingDistribution != null) ...[
            const SizedBox(height: 14),
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: AppColors.accentOrange.withValues(alpha: 0.10),
                borderRadius: BorderRadius.circular(16),
                border:
                    Border.all(color: AppColors.accentOrange.withValues(alpha: 0.4)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.all(8),
                        decoration: BoxDecoration(
                          color: AppColors.accentOrange,
                          borderRadius: BorderRadius.circular(10),
                        ),
                        child: const Icon(Icons.inventory_2_rounded,
                            color: Colors.white, size: 18),
                      ),
                      const SizedBox(width: 10),
                      const Expanded(
                        child: Text(
                          'Ada stok masuk untuk Shift 1',
                          style: TextStyle(fontWeight: FontWeight.w700),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 4),
                  const Text(
                    'Silakan periksa & terima stok untuk memulai penjualan.',
                    style: TextStyle(
                        color: AppColors.textSecondary, fontSize: 13),
                  ),
                  const SizedBox(height: 12),
                  ElevatedButton(
                    onPressed: () => context.push('/receive-stock'),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppColors.accentOrange,
                      minimumSize: const Size.fromHeight(46),
                    ),
                    child: const Text('Lihat & Terima Stok'),
                  ),
                ],
              ),
            ),
          ],
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(
                child: KpiTile(
                  label: 'Penjualan Hari Ini',
                  value: formatRupiah(shift.omzetToday),
                  icon: Icons.trending_up_rounded,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: KpiTile(
                  label: 'Cup Terjual',
                  value: formatCup(shift.cupSoldToday),
                  icon: Icons.local_cafe_outlined,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: KpiTile(
                  label: 'Stok Alert',
                  value: '$lowStockCount item',
                  icon: Icons.warning_amber_rounded,
                  valueColor:
                      lowStockCount > 0 ? AppColors.warning : null,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: KpiTile(
                  label: 'Transaksi',
                  value: '${shift.transactionCount}',
                  icon: Icons.receipt_long_rounded,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
