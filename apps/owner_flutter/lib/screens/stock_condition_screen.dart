import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../app_state.dart';
import 'discrepancy_screen.dart';

class StockConditionScreen extends StatefulWidget {
  const StockConditionScreen({super.key});

  @override
  State<StockConditionScreen> createState() => _StockConditionScreenState();
}

class _StockConditionScreenState extends State<StockConditionScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => context.read<AppState>().refreshStockCondition());
  }

  @override
  Widget build(BuildContext context) {
    final state = context.watch<AppState>();
    final data = state.stockCondition;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Kondisi Stok'),
        actions: [
          IconButton(
            icon: const Icon(Icons.report_problem_outlined),
            tooltip: 'Discrepancy',
            onPressed: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const DiscrepancyScreen())),
          ),
        ],
      ),
      body: data == null
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: state.refreshStockCondition,
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  Card(
                    child: Padding(
                      padding: const EdgeInsets.all(20),
                      child: Column(
                        children: [
                          Text('${data['safePct']}%', style: const TextStyle(fontSize: 40, fontWeight: FontWeight.bold, color: Colors.green)),
                          const Text('Stok Aman'),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      Expanded(
                        child: Card(
                          color: Colors.amber.shade50,
                          child: Padding(
                            padding: const EdgeInsets.all(16),
                            child: Column(
                              children: [
                                Text('${data['lowCount']}', style: const TextStyle(fontSize: 22, fontWeight: FontWeight.bold)),
                                const Text('Menipis/Kritis'),
                              ],
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Card(
                          color: Colors.red.shade50,
                          child: Padding(
                            padding: const EdgeInsets.all(16),
                            child: Column(
                              children: [
                                Text('${data['outCount']}', style: const TextStyle(fontSize: 22, fontWeight: FontWeight.bold)),
                                const Text('Habis'),
                              ],
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 20),
                  Text('Item Bermasalah', style: Theme.of(context).textTheme.titleSmall),
                  const SizedBox(height: 8),
                  ...List<Map<String, dynamic>>.from(data['problemItems'] as List).map(
                    (item) => Card(
                      margin: const EdgeInsets.only(bottom: 6),
                      child: ListTile(
                        title: Text(item['productName']),
                        subtitle: Text(item['boothName']),
                        trailing: Chip(
                          label: Text(item['status']),
                          backgroundColor: item['status'] == 'Habis' ? Colors.red.shade100 : Colors.amber.shade100,
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
    );
  }
}
