import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../app_state.dart';
import '../theme.dart';
import 'booth_detail_screen.dart';

final _rupiah = NumberFormat.currency(locale: 'id_ID', symbol: 'Rp', decimalDigits: 0);

const _medalColors = [Color(0xFFE8B830), Color(0xFFB0B7BD), Color(0xFFCD8A4E)];

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
      backgroundColor: ObbelTheme.backgroundLight,
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        foregroundColor: ObbelTheme.textDark,
        title: const Text('Ranking Booth', style: TextStyle(color: ObbelTheme.textDark, fontWeight: FontWeight.bold)),
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(16),
            child: Row(
              children: [
                _PeriodChip(label: 'Hari Ini', value: 'today', selected: _period, onSelect: _select),
                const SizedBox(width: 8),
                _PeriodChip(label: '7 Hari', value: '7d', selected: _period, onSelect: _select),
                const SizedBox(width: 8),
                _PeriodChip(label: 'Bulan Ini', value: 'month', selected: _period, onSelect: _select),
              ],
            ),
          ),
          Expanded(
            child: RefreshIndicator(
              onRefresh: _load,
              child: ranking.isEmpty
                  ? ListView(children: const [Padding(padding: EdgeInsets.all(32), child: Center(child: Text('Belum ada data.')))])
                  : ListView.separated(
                      padding: const EdgeInsets.symmetric(horizontal: 16),
                      itemCount: ranking.length,
                      separatorBuilder: (_, _) => const SizedBox(height: 10),
                      itemBuilder: (context, index) {
                        final row = ranking[index] as Map<String, dynamic>;
                        final medal = index < 3 ? _medalColors[index] : null;
                        return InkWell(
                          borderRadius: BorderRadius.circular(16),
                          onTap: () => Navigator.of(context).push(
                            MaterialPageRoute(builder: (_) => BoothDetailScreen(boothId: row['boothId'], boothName: row['boothName'])),
                          ),
                          child: Container(
                            padding: const EdgeInsets.all(14),
                            decoration: BoxDecoration(
                              color: Colors.white,
                              borderRadius: BorderRadius.circular(16),
                              border: Border.all(color: Colors.grey.shade200),
                            ),
                            child: Row(
                              children: [
                                CircleAvatar(
                                  backgroundColor: medal ?? ObbelTheme.backgroundLight,
                                  foregroundColor: medal != null ? Colors.white : ObbelTheme.textDark,
                                  child: Text('${index + 1}', style: const TextStyle(fontWeight: FontWeight.bold)),
                                ),
                                const SizedBox(width: 12),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text(row['boothName'], style: const TextStyle(fontWeight: FontWeight.w800, color: ObbelTheme.textDark)),
                                      Text('${row['cup']} cup', style: const TextStyle(color: ObbelTheme.textLight, fontSize: 12, fontWeight: FontWeight.w600)),
                                    ],
                                  ),
                                ),
                                Text(_rupiah.format(row['omzet']), style: const TextStyle(fontWeight: FontWeight.w900, color: ObbelTheme.primaryDark)),
                              ],
                            ),
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
    final isSelected = selected == value;
    return GestureDetector(
      onTap: () => onSelect(value),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 9),
        decoration: BoxDecoration(
          color: isSelected ? ObbelTheme.primaryDark : Colors.white,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: isSelected ? ObbelTheme.primaryDark : Colors.grey.shade300),
        ),
        child: Text(
          label,
          style: TextStyle(color: isSelected ? Colors.white : ObbelTheme.textDark, fontWeight: FontWeight.w700, fontSize: 13),
        ),
      ),
    );
  }
}
