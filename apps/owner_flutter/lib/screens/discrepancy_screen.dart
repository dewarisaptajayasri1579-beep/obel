import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../app_state.dart';

final _rupiah = NumberFormat.currency(locale: 'id_ID', symbol: 'Rp', decimalDigits: 0);

class DiscrepancyScreen extends StatefulWidget {
  const DiscrepancyScreen({super.key});

  @override
  State<DiscrepancyScreen> createState() => _DiscrepancyScreenState();
}

class _DiscrepancyScreenState extends State<DiscrepancyScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => context.read<AppState>().refreshDiscrepancy());
  }

  @override
  Widget build(BuildContext context) {
    final state = context.watch<AppState>();
    final rows = state.discrepancy;

    return Scaffold(
      appBar: AppBar(title: const Text('Discrepancy')),
      body: RefreshIndicator(
        onRefresh: state.refreshDiscrepancy,
        child: rows.isEmpty
            ? ListView(children: const [Padding(padding: EdgeInsets.all(32), child: Center(child: Text('Tidak ada discrepancy.')))])
            : ListView.builder(
                padding: const EdgeInsets.all(12),
                itemCount: rows.length,
                itemBuilder: (context, index) {
                  final row = rows[index] as Map<String, dynamic>;
                  final qty = row['qtyDiscrepancy'] as int;
                  return Card(
                    margin: const EdgeInsets.only(bottom: 8),
                    child: ListTile(
                      title: Text(row['productName']),
                      subtitle: Text('${row['boothName']} — ${row['source']}'),
                      trailing: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        crossAxisAlignment: CrossAxisAlignment.end,
                        children: [
                          Text(
                            '${qty > 0 ? '+' : ''}$qty',
                            style: TextStyle(fontWeight: FontWeight.bold, color: qty < 0 ? Colors.red : Colors.green),
                          ),
                          Text(_rupiah.format(row['estimatedValue']), style: const TextStyle(fontSize: 11)),
                        ],
                      ),
                    ),
                  );
                },
              ),
      ),
    );
  }
}
