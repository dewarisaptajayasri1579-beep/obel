import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../app_state.dart';
import '../theme.dart';
import 'discrepancy_screen.dart';
import 'penjualan_screen.dart';
import 'stock_condition_screen.dart';

final _rupiah = NumberFormat.currency(locale: 'id_ID', symbol: 'Rp', decimalDigits: 0);

class LaporanScreen extends StatefulWidget {
  const LaporanScreen({super.key});

  @override
  State<LaporanScreen> createState() => _LaporanScreenState();
}

class _LaporanScreenState extends State<LaporanScreen> {
  bool _exporting = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<AppState>().refreshDiscrepancy();
      context.read<AppState>().refreshStockCondition();
    });
  }

  Future<void> _handleExport() async {
    setState(() => _exporting = true);
    try {
      final path = await context.read<AppState>().exportReportsCsv();
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Laporan tersimpan: $path')));
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Gagal mengunduh laporan.')));
    } finally {
      if (mounted) setState(() => _exporting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final state = context.watch<AppState>();
    final rows = List<Map<String, dynamic>>.from(state.discrepancy);

    final totalCup = rows.fold<int>(0, (sum, r) => sum + (r['qtyDiscrepancy'] as int));
    final totalValue = rows.fold<int>(0, (sum, r) => sum + (r['estimatedValue'] as int));

    final byBooth = <String, int>{};
    for (final r in rows) {
      byBooth[r['boothName']] = (byBooth[r['boothName']] ?? 0) + (r['qtyDiscrepancy'] as int);
    }
    final boothEntries = byBooth.entries.toList()..sort((a, b) => a.value.compareTo(b.value));

    return Scaffold(
      backgroundColor: ObbelTheme.backgroundLight,
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        foregroundColor: ObbelTheme.textDark,
        title: const Text('Laporan & Selisih Stok', style: TextStyle(color: ObbelTheme.textDark, fontWeight: FontWeight.bold)),
      ),
      body: RefreshIndicator(
        onRefresh: () async {
          await state.refreshDiscrepancy();
          await state.refreshStockCondition();
        },
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            Row(
              children: [
                Expanded(
                  child: _bigCard(
                    color: const Color(0xFFFDECEC),
                    borderColor: const Color(0xFFF7C9C9),
                    label: 'Selisih Stok Hari Ini',
                    value: '${totalCup > 0 ? '+' : ''}$totalCup cup',
                    valueColor: ObbelTheme.accentRed,
                    sub: 'Total Selisih',
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: _bigCard(
                    color: const Color(0xFFFFF4E9),
                    borderColor: const Color(0xFFFFDEC9),
                    label: 'Estimasi Nilai Selisih',
                    value: _rupiah.format(-totalValue),
                    valueColor: ObbelTheme.accentOrange,
                    sub: 'Potensi Kerugian',
                  ),
                ),
              ],
            ),
            const SizedBox(height: 24),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text('Booth dengan Selisih', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 15, color: ObbelTheme.textDark)),
                TextButton(
                  onPressed: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const DiscrepancyScreen())),
                  child: const Text('Lihat semua'),
                ),
              ],
            ),
            const SizedBox(height: 8),
            if (boothEntries.isEmpty)
              const Padding(padding: EdgeInsets.symmetric(vertical: 16), child: Text('Tidak ada selisih stok.', style: TextStyle(color: ObbelTheme.textLight)))
            else
              ...boothEntries.take(5).map(
                    (e) => Container(
                      margin: const EdgeInsets.only(bottom: 8),
                      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(14), border: Border.all(color: Colors.grey.shade200)),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text(e.key, style: const TextStyle(fontWeight: FontWeight.w700, color: ObbelTheme.textDark, fontSize: 13)),
                          Text('${e.value} cup', style: const TextStyle(fontWeight: FontWeight.w900, color: ObbelTheme.accentRed, fontSize: 13)),
                        ],
                      ),
                    ),
                  ),
            const SizedBox(height: 24),
            const Text('Menu Laporan Cepat', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 15, color: ObbelTheme.textDark)),
            const SizedBox(height: 10),
            GridView.count(
              crossAxisCount: 2,
              crossAxisSpacing: 12,
              mainAxisSpacing: 12,
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              childAspectRatio: 1.6,
              children: [
                _menuCard(
                  context,
                  Icons.receipt_long_outlined,
                  'Laporan Penjualan',
                  'Ringkasan detail',
                  () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const PenjualanScreen())),
                ),
                _menuCard(
                  context,
                  Icons.storefront_outlined,
                  'Per Booth',
                  'Analisa setiap booth',
                  () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const PenjualanScreen())),
                ),
                _menuCard(
                  context,
                  Icons.local_cafe_outlined,
                  'Per Produk',
                  'Analisa produk',
                  () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const PenjualanScreen())),
                ),
                _menuCard(
                  context,
                  Icons.inventory_2_outlined,
                  'Selisih Stok',
                  'Selisih & estimasi',
                  () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const StockConditionScreen())),
                ),
              ],
            ),
            const SizedBox(height: 20),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton.icon(
                onPressed: _exporting ? null : _handleExport,
                icon: _exporting
                    ? const SizedBox(
                        height: 16,
                        width: 16,
                        child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                      )
                    : const Icon(Icons.download_outlined, color: Colors.white),
                label: const Text('Download / Export Laporan', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                style: ElevatedButton.styleFrom(
                  backgroundColor: ObbelTheme.primaryDark,
                  padding: const EdgeInsets.symmetric(vertical: 16),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _bigCard({
    required Color color,
    required Color borderColor,
    required String label,
    required String value,
    required Color valueColor,
    required String sub,
  }) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(color: color, borderRadius: BorderRadius.circular(16), border: Border.all(color: borderColor)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: const TextStyle(fontSize: 11, color: ObbelTheme.textLight, fontWeight: FontWeight.w700)),
          const SizedBox(height: 6),
          Text(value, style: TextStyle(fontFamily: 'Outfit', fontSize: 18, fontWeight: FontWeight.w900, color: valueColor)),
          const SizedBox(height: 2),
          Text(sub, style: const TextStyle(fontSize: 11, color: ObbelTheme.textLight)),
        ],
      ),
    );
  }

  Widget _menuCard(BuildContext context, IconData icon, String title, String subtitle, VoidCallback? onTap) {
    return InkWell(
      borderRadius: BorderRadius.circular(14),
      onTap: onTap ?? () => ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Segera hadir.'))),
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(14), border: Border.all(color: Colors.grey.shade200)),
        child: Row(
          children: [
            Icon(icon, color: ObbelTheme.primaryMedium),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(title, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 12, color: ObbelTheme.textDark)),
                  Text(subtitle, style: const TextStyle(fontSize: 10, color: ObbelTheme.textLight)),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
