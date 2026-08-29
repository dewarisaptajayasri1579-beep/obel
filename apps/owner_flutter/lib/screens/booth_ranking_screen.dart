import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../app_state.dart';
import 'booth_detail_screen.dart';

final _rupiah = NumberFormat.currency(locale: 'id_ID', symbol: 'Rp', decimalDigits: 0);

class BoothRankingScreen extends StatefulWidget {
  const BoothRankingScreen({super.key});

  @override
  State<BoothRankingScreen> createState() => _BoothRankingScreenState();
}

class _BoothRankingScreenState extends State<BoothRankingScreen> {
  String _period = 'today';

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  Future<void> _load() => context.read<AppState>().refreshBoothRanking(_period);

  @override
  Widget build(BuildContext context) {
    final state = context.watch<AppState>();
    final ranking = state.boothRanking;

    return Scaffold(
      appBar: AppBar(title: const Text('Booth Ranking')),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(12),
            child: Wrap(
              spacing: 8,
              children: [
                _PeriodChip(label: 'Hari Ini', value: 'today', selected: _period, onSelect: _select),
                _PeriodChip(label: '7 Hari', value: '7d', selected: _period, onSelect: _select),
                _PeriodChip(label: 'Bulan Ini', value: 'month', selected: _period, onSelect: _select),
              ],
            ),
          ),
          Expanded(
            child: RefreshIndicator(
              onRefresh: _load,
              child: ranking.isEmpty
                  ? ListView(children: const [Padding(padding: EdgeInsets.all(32), child: Center(child: Text('Belum ada data.')))])
                  : ListView.builder(
                      itemCount: ranking.length,
                      itemBuilder: (context, index) {
                        final row = ranking[index] as Map<String, dynamic>;
                        return ListTile(
                          leading: CircleAvatar(child: Text('${index + 1}')),
                          title: Text(row['boothName']),
                          subtitle: Text('${row['cup']} cup'),
                          trailing: Text(_rupiah.format(row['omzet']), style: const TextStyle(fontWeight: FontWeight.bold)),
                          onTap: () => Navigator.of(context).push(
                            MaterialPageRoute(builder: (_) => BoothDetailScreen(boothId: row['boothId'], boothName: row['boothName'])),
                          ),
                        );
                      },
                    ),
            ),
          ),
        ],
      ),
    );
  }

  void _select(String value) {
    setState(() => _period = value);
    _load();
  }
}

class _PeriodChip extends StatelessWidget {
  const _PeriodChip({required this.label, required this.value, required this.selected, required this.onSelect});

  final String label;
  final String value;
  final String selected;
  final ValueChanged<String> onSelect;

  @override
  Widget build(BuildContext context) {
    return ChoiceChip(
      label: Text(label),
      selected: selected == value,
      onSelected: (_) => onSelect(value),
    );
  }
}
