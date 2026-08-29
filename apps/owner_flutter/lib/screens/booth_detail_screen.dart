import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../app_state.dart';

final _rupiah = NumberFormat.currency(locale: 'id_ID', symbol: 'Rp', decimalDigits: 0);

class BoothDetailScreen extends StatefulWidget {
  const BoothDetailScreen({super.key, required this.boothId, required this.boothName});

  final String boothId;
  final String boothName;

  @override
  State<BoothDetailScreen> createState() => _BoothDetailScreenState();
}

class _BoothDetailScreenState extends State<BoothDetailScreen> {
  Map<String, dynamic>? _detail;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final detail = await context.read<AppState>().loadBoothDetail(widget.boothId);
    if (mounted) setState(() => _detail = detail);
  }

  @override
  Widget build(BuildContext context) {
    final detail = _detail;
    return Scaffold(
      appBar: AppBar(title: Text(widget.boothName)),
      body: detail == null
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _load,
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Card(
                          child: Padding(
                            padding: const EdgeInsets.all(16),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                const Text('Omzet Hari Ini', style: TextStyle(fontSize: 12)),
                                Text(_rupiah.format(detail['omzetToday']), style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                              ],
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Card(
                          child: Padding(
                            padding: const EdgeInsets.all(16),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                const Text('Cup Terjual', style: TextStyle(fontSize: 12)),
                                Text('${detail['cupSoldToday']}', style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                              ],
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  Card(
                    child: ListTile(
                      title: const Text('Transaksi Hari Ini'),
                      trailing: Text('${detail['transactionCountToday']}'),
                    ),
                  ),
                  const SizedBox(height: 20),
                  Text('Produk Terlaris', style: Theme.of(context).textTheme.titleSmall),
                  const SizedBox(height: 8),
                  ...List<Map<String, dynamic>>.from(detail['topProducts'] as List).map(
                    (p) => Card(
                      margin: const EdgeInsets.only(bottom: 6),
                      child: ListTile(title: Text(p['productName']), trailing: Text('${p['qty']} cup')),
                    ),
                  ),
                  const SizedBox(height: 20),
                  Text('Sisa Stok', style: Theme.of(context).textTheme.titleSmall),
                  const SizedBox(height: 8),
                  ...List<Map<String, dynamic>>.from(detail['stockRemaining'] as List).map(
                    (s) => Card(
                      margin: const EdgeInsets.only(bottom: 6),
                      child: ListTile(title: Text(s['productName']), trailing: Text('${s['qtyOnHand']}')),
                    ),
                  ),
                  const SizedBox(height: 20),
                  Text('Shift Terakhir', style: Theme.of(context).textTheme.titleSmall),
                  const SizedBox(height: 8),
                  ...List<Map<String, dynamic>>.from(detail['recentShifts'] as List).map(
                    (s) => Card(
                      margin: const EdgeInsets.only(bottom: 6),
                      child: ListTile(
                        title: Text('${s['shiftName']} — ${s['staffName']}'),
                        trailing: Text(s['status']),
                      ),
                    ),
                  ),
                ],
              ),
            ),
    );
  }
}
