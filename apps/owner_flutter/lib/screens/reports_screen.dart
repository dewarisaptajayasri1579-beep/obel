import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../app_state.dart';

final _rupiah = NumberFormat.currency(locale: 'id_ID', symbol: 'Rp', decimalDigits: 0);

class ReportsScreen extends StatefulWidget {
  const ReportsScreen({super.key});

  @override
  State<ReportsScreen> createState() => _ReportsScreenState();
}

class _ReportsScreenState extends State<ReportsScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => context.read<AppState>().refreshReportsSummary());
  }

  @override
  Widget build(BuildContext context) {
    final state = context.watch<AppState>();
    final data = state.reportsSummary;

    return Scaffold(
      appBar: AppBar(title: const Text('Laporan')),
      body: data == null
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: state.refreshReportsSummary,
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  _SectionTitle('Tren Penjualan 7 Hari'),
                  const SizedBox(height: 8),
                  _SalesTrendChart(trend: List<Map<String, dynamic>>.from(data['salesTrend'] as List)),
                  const SizedBox(height: 24),
                  _SectionTitle('Booth Ranking'),
                  const SizedBox(height: 8),
                  ...List<Map<String, dynamic>>.from(data['boothRanking'] as List).map(
                    (b) => Card(
                      margin: const EdgeInsets.only(bottom: 6),
                      child: ListTile(
                        title: Text(b['boothName']),
                        subtitle: Text('${b['cup']} cup'),
                        trailing: Text(_rupiah.format(b['omzet']), style: const TextStyle(fontWeight: FontWeight.bold)),
                      ),
                    ),
                  ),
                  const SizedBox(height: 24),
                  _SectionTitle('Produk Terlaris'),
                  const SizedBox(height: 8),
                  ...List<Map<String, dynamic>>.from(data['productRanking'] as List).map(
                    (p) => Card(
                      margin: const EdgeInsets.only(bottom: 6),
                      child: ListTile(title: Text(p['productName']), trailing: Text('${p['qty']} cup')),
                    ),
                  ),
                ],
              ),
            ),
    );
  }
}

class _SectionTitle extends StatelessWidget {
  const _SectionTitle(this.text);
  final String text;

  @override
  Widget build(BuildContext context) => Text(text, style: Theme.of(context).textTheme.titleMedium);
}

class _SalesTrendChart extends StatelessWidget {
  const _SalesTrendChart({required this.trend});
  final List<Map<String, dynamic>> trend;

  @override
  Widget build(BuildContext context) {
    final maxOmzet = trend.fold<int>(1, (max, d) => (d['omzet'] as int) > max ? d['omzet'] as int : max);
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          children: trend.map((d) {
            final ratio = (d['omzet'] as int) / maxOmzet;
            return Padding(
              padding: const EdgeInsets.symmetric(vertical: 4),
              child: Row(
                children: [
                  SizedBox(width: 70, child: Text(d['date'], style: const TextStyle(fontSize: 11))),
                  Expanded(
                    child: FractionallySizedBox(
                      alignment: Alignment.centerLeft,
                      widthFactor: ratio.clamp(0.02, 1.0),
                      child: Container(height: 14, decoration: BoxDecoration(color: Theme.of(context).colorScheme.primary, borderRadius: BorderRadius.circular(4))),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Text(_rupiah.format(d['omzet']), style: const TextStyle(fontSize: 11)),
                ],
              ),
            );
          }).toList(),
        ),
      ),
    );
  }
}
