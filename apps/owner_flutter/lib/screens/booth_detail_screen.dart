import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../app_state.dart';
import '../theme.dart';

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
    final status = detail?['booth']?['status'] as String?;

    return Scaffold(
      backgroundColor: ObbelTheme.backgroundLight,
      body: detail == null
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _load,
              child: CustomScrollView(
                slivers: [
                  SliverAppBar(
                    pinned: true,
                    expandedHeight: 150,
                    backgroundColor: ObbelTheme.primaryDark,
                    foregroundColor: Colors.white,
                    flexibleSpace: FlexibleSpaceBar(
                      title: Text(widget.boothName, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                      background: Container(
                        decoration: const BoxDecoration(
                          image: DecorationImage(image: AssetImage('assets/images/back-img.png'), fit: BoxFit.cover),
                        ),
                      ),
                    ),
                    actions: [
                      if (status != null)
                        Padding(
                          padding: const EdgeInsets.only(right: 16, top: 12),
                          child: Chip(
                            label: Text(status == 'ACTIVE' ? 'Aktif' : 'Nonaktif', style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.bold)),
                            backgroundColor: status == 'ACTIVE' ? ObbelTheme.primaryMedium : Colors.grey,
                            padding: EdgeInsets.zero,
                            visualDensity: VisualDensity.compact,
                          ),
                        ),
                    ],
                  ),
                  SliverPadding(
                    padding: const EdgeInsets.all(16),
                    sliver: SliverList(
                      delegate: SliverChildListDelegate([
                        Row(
                          children: [
                            Expanded(child: _statCard('Omzet Hari Ini', _rupiah.format(detail['omzetToday']))),
                            const SizedBox(width: 12),
                            Expanded(child: _statCard('Cup Terjual', '${detail['cupSoldToday']} cup')),
                          ],
                        ),
                        const SizedBox(height: 12),
                        Row(
                          children: [
                            Expanded(child: _statCard('Transaksi', '${detail['transactionCountToday']}')),
                            const SizedBox(width: 12),
                            Expanded(
                              child: _statCard(
                                'Stok Tersedia',
                                '${(detail['stockRemaining'] as List).fold<int>(0, (sum, s) => sum + (s['qtyOnHand'] as int))} cup',
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 24),
                        const Text('Produk Terlaris', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 15, color: ObbelTheme.textDark)),
                        const SizedBox(height: 10),
                        ...List<Map<String, dynamic>>.from(detail['topProducts'] as List).map(
                          (p) => _listRow(p['productName'], '${p['qty']} cup'),
                        ),
                        const SizedBox(height: 24),
                        const Text('Sisa Stok', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 15, color: ObbelTheme.textDark)),
                        const SizedBox(height: 10),
                        ...List<Map<String, dynamic>>.from(detail['stockRemaining'] as List).map(
                          (s) => _listRow(s['productName'], '${s['qtyOnHand']}'),
                        ),
                        const SizedBox(height: 24),
                        const Text('Riwayat Shift', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 15, color: ObbelTheme.textDark)),
                        const SizedBox(height: 10),
                        ...List<Map<String, dynamic>>.from(detail['recentShifts'] as List).map(
                          (s) => _listRow('${s['shiftName']} — ${s['staffName']}', s['status']),
                        ),
                        const SizedBox(height: 16),
                      ]),
                    ),
                  ),
                ],
              ),
            ),
    );
  }

  Widget _statCard(String label, String value) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(16), border: Border.all(color: Colors.grey.shade200)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: const TextStyle(fontSize: 12, color: ObbelTheme.textLight, fontWeight: FontWeight.w600)),
          const SizedBox(height: 4),
          Text(value, style: const TextStyle(fontFamily: 'Outfit', fontSize: 17, fontWeight: FontWeight.w900, color: ObbelTheme.textDark)),
        ],
      ),
    );
  }

  Widget _listRow(String title, String trailing) {
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(14), border: Border.all(color: Colors.grey.shade200)),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Expanded(child: Text(title, style: const TextStyle(fontWeight: FontWeight.w700, color: ObbelTheme.textDark, fontSize: 13))),
          Text(trailing, style: const TextStyle(fontWeight: FontWeight.w800, color: ObbelTheme.primaryDark, fontSize: 13)),
        ],
      ),
    );
  }
}
