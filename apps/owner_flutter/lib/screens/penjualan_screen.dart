import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../app_state.dart';
import '../theme.dart';

final _rupiah = NumberFormat.currency(locale: 'id_ID', symbol: 'Rp', decimalDigits: 0);

class PenjualanScreen extends StatefulWidget {
  const PenjualanScreen({super.key});

  @override
  State<PenjualanScreen> createState() => _PenjualanScreenState();
}

class _PenjualanScreenState extends State<PenjualanScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => context.read<AppState>().refreshReportsSummary());
  }

  @override
  Widget build(BuildContext context) {
    final state = context.watch<AppState>();
    final data = state.reportsSummary;
    final totalOmzet = data == null
        ? 0
        : List<Map<String, dynamic>>.from(data['salesTrend'] as List).fold<int>(0, (sum, d) => sum + (d['omzet'] as int));

    return Scaffold(
      backgroundColor: ObbelTheme.backgroundLight,
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        foregroundColor: ObbelTheme.textDark,
        title: const Text('Penjualan', style: TextStyle(color: ObbelTheme.textDark, fontWeight: FontWeight.bold)),
      ),
      body: data == null
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: state.refreshReportsSummary,
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(20),
                    decoration: BoxDecoration(
                      color: const Color(0xFFEAF6EF),
                      borderRadius: BorderRadius.circular(18),
                      border: Border.all(color: const Color(0xFFCDEBD9)),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text('TOTAL OMZET 7 HARI', style: TextStyle(color: ObbelTheme.primaryMedium, fontWeight: FontWeight.bold, fontSize: 12, letterSpacing: 0.5)),
                        const SizedBox(height: 6),
                        Text(_rupiah.format(totalOmzet), style: const TextStyle(fontFamily: 'Outfit', fontSize: 26, fontWeight: FontWeight.w900, color: ObbelTheme.textDark)),
                      ],
                    ),
                  ),
                  const SizedBox(height: 20),
                  const Text('Grafik Omzet (7 Hari Terakhir)', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 14, color: ObbelTheme.textDark)),
                  const SizedBox(height: 10),
                  _SalesTrendChart(trend: List<Map<String, dynamic>>.from(data['salesTrend'] as List)),
                  const SizedBox(height: 24),
                  const Text('Top Produk', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 15, color: ObbelTheme.textDark)),
                  const SizedBox(height: 10),
                  ...List<Map<String, dynamic>>.from(data['productRanking'] as List).take(5).toList().asMap().entries.map(
                        (e) => _rankRow(e.key + 1, e.value['productName'], '${e.value['qty']} cup'),
                      ),
                  const SizedBox(height: 24),
                  const Text('Top Booth', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 15, color: ObbelTheme.textDark)),
                  const SizedBox(height: 10),
                  ...List<Map<String, dynamic>>.from(data['boothRanking'] as List).take(5).toList().asMap().entries.map(
                        (e) => _rankRow(e.key + 1, e.value['boothName'], _rupiah.format(e.value['omzet'])),
                      ),
                ],
              ),
            ),
    );
  }

  Widget _rankRow(int rank, String title, String trailing) {
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(14), border: Border.all(color: Colors.grey.shade200)),
      child: Row(
        children: [
          Text('$rank', style: const TextStyle(fontWeight: FontWeight.w900, color: ObbelTheme.primaryMedium, fontSize: 13)),
          const SizedBox(width: 12),
          Expanded(child: Text(title, style: const TextStyle(fontWeight: FontWeight.w700, color: ObbelTheme.textDark, fontSize: 13))),
          Text(trailing, style: const TextStyle(fontWeight: FontWeight.w800, color: ObbelTheme.textDark, fontSize: 13)),
        ],
      ),
    );
  }
}

class _SalesTrendChart extends StatelessWidget {
  const _SalesTrendChart({required this.trend});
  final List<Map<String, dynamic>> trend;

  @override
  Widget build(BuildContext context) {
    final maxOmzet = trend.fold<int>(1, (max, d) => (d['omzet'] as int) > max ? d['omzet'] as int : max);
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(16), border: Border.all(color: Colors.grey.shade200)),
      child: Column(
        children: trend.map((d) {
          final ratio = (d['omzet'] as int) / maxOmzet;
          return Padding(
            padding: const EdgeInsets.symmetric(vertical: 4),
            child: Row(
              children: [
                SizedBox(width: 66, child: Text(d['date'].toString().substring(5), style: const TextStyle(fontSize: 11, color: ObbelTheme.textLight))),
                Expanded(
                  child: FractionallySizedBox(
                    alignment: Alignment.centerLeft,
                    widthFactor: ratio.clamp(0.02, 1.0),
                    child: Container(height: 14, decoration: BoxDecoration(color: ObbelTheme.primaryMedium, borderRadius: BorderRadius.circular(4))),
                  ),
                ),
                const SizedBox(width: 8),
                Text(_rupiah.format(d['omzet']), style: const TextStyle(fontSize: 11, color: ObbelTheme.textDark, fontWeight: FontWeight.w600)),
              ],
            ),
          );
        }).toList(),
      ),
    );
  }
}
