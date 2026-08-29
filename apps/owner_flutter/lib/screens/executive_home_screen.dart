import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../app_state.dart';

final _rupiah = NumberFormat.currency(locale: 'id_ID', symbol: 'Rp', decimalDigits: 0);

class ExecutiveHomeScreen extends StatefulWidget {
  const ExecutiveHomeScreen({super.key});

  @override
  State<ExecutiveHomeScreen> createState() => _ExecutiveHomeScreenState();
}

class _ExecutiveHomeScreenState extends State<ExecutiveHomeScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<AppState>().refreshExecutiveHome();
    });
  }

  @override
  Widget build(BuildContext context) {
    final state = context.watch<AppState>();
    final data = state.executiveHome;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Obbel Owner'),
        actions: [
          IconButton(icon: const Icon(Icons.logout), onPressed: state.logout),
        ],
      ),
      body: data == null
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: state.refreshExecutiveHome,
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  Text('Halo, ${state.fullName ?? ''}', style: Theme.of(context).textTheme.titleMedium),
                  const SizedBox(height: 16),
                  Row(
                    children: [
                      Expanded(
                        child: _StatCard(
                          label: 'Omzet Hari Ini',
                          value: _rupiah.format(data['omzetToday']),
                          delta: data['omzetDeltaPct'],
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(child: _StatCard(label: 'Cup Terjual', value: '${data['cupSoldToday']} cup')),
                    ],
                  ),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      Expanded(child: _StatCard(label: 'Booth Aktif', value: '${data['activeBoothsCount']}')),
                      const SizedBox(width: 12),
                      Expanded(
                        child: _StatCard(
                          label: 'Perlu Perhatian',
                          value: '${data['attentionCount']}',
                          highlight: (data['attentionCount'] as int) > 0,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 20),
                  if (data['bestBooth'] != null) ...[
                    Text('Booth Terbaik Hari Ini', style: Theme.of(context).textTheme.titleSmall),
                    const SizedBox(height: 8),
                    Card(
                      child: ListTile(
                        leading: const Icon(Icons.emoji_events, color: Colors.amber),
                        title: Text(data['bestBooth']['boothName']),
                        subtitle: Text(_rupiah.format(data['bestBooth']['omzet'])),
                      ),
                    ),
                    const SizedBox(height: 20),
                  ],
                  Text('Alert', style: Theme.of(context).textTheme.titleSmall),
                  const SizedBox(height: 8),
                  _AlertTile(label: 'Stok Menipis/Kritis/Habis', value: data['lowStockCount']),
                  _AlertTile(label: 'Distribusi Pending', value: data['pendingDistributions']),
                  _AlertTile(label: 'Restock Pending', value: data['pendingRestock']),
                  _AlertTile(label: 'Return Pending', value: data['pendingReturns']),
                  _AlertTile(label: 'Perlu Rekonsiliasi', value: data['reconciliationCasesOpen']),
                ],
              ),
            ),
    );
  }
}

class _StatCard extends StatelessWidget {
  const _StatCard({required this.label, required this.value, this.delta, this.highlight = false});

  final String label;
  final String value;
  final int? delta;
  final bool highlight;

  @override
  Widget build(BuildContext context) {
    return Card(
      color: highlight ? Colors.amber.shade50 : null,
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(label, style: Theme.of(context).textTheme.bodySmall),
            const SizedBox(height: 4),
            Text(value, style: Theme.of(context).textTheme.titleLarge),
            if (delta != null)
              Text(
                '${delta! > 0 ? '+' : ''}$delta% vs kemarin',
                style: TextStyle(color: delta! >= 0 ? Colors.green : Colors.red, fontSize: 12),
              ),
          ],
        ),
      ),
    );
  }
}

class _AlertTile extends StatelessWidget {
  const _AlertTile({required this.label, required this.value});

  final String label;
  final int value;

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      child: ListTile(
        leading: Icon(
          value > 0 ? Icons.warning_amber_rounded : Icons.check_circle_outline,
          color: value > 0 ? Colors.orange : Colors.green,
        ),
        title: Text(label),
        trailing: Text('$value', style: const TextStyle(fontWeight: FontWeight.bold)),
      ),
    );
  }
}
