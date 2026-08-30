import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../app_state.dart';
import '../theme.dart';

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
      backgroundColor: ObbelTheme.backgroundLight,
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        toolbarHeight: 65,
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Selamat pagi,', style: TextStyle(fontSize: 13, color: ObbelTheme.textLight, fontWeight: FontWeight.w500)),
            Text('Owner', style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: ObbelTheme.textDark)),
          ],
        ),
        actions: [
          IconButton(icon: const Icon(Icons.notifications_outlined, color: ObbelTheme.textDark), onPressed: () {}),
          IconButton(icon: const Icon(Icons.logout, color: ObbelTheme.textDark), onPressed: state.logout),
        ],
      ),
      body: data == null
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: state.refreshExecutiveHome,
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
                        const Text('OMZET HARI INI', style: TextStyle(color: ObbelTheme.primaryMedium, fontWeight: FontWeight.bold, fontSize: 12, letterSpacing: 0.5)),
                        const SizedBox(height: 6),
                        Text(
                          _rupiah.format(data['omzetToday']),
                          style: const TextStyle(fontFamily: 'Outfit', fontSize: 28, fontWeight: FontWeight.w900, color: ObbelTheme.textDark),
                        ),
                        if (data['omzetDeltaPct'] != null) ...[
                          const SizedBox(height: 4),
                          Row(
                            children: [
                              Icon(
                                (data['omzetDeltaPct'] as int) >= 0 ? Icons.arrow_upward : Icons.arrow_downward,
                                size: 14,
                                color: (data['omzetDeltaPct'] as int) >= 0 ? ObbelTheme.primaryMedium : ObbelTheme.accentRed,
                              ),
                              const SizedBox(width: 4),
                              Text(
                                '${data['omzetDeltaPct']}% dari kemarin',
                                style: TextStyle(
                                  fontSize: 12,
                                  fontWeight: FontWeight.w700,
                                  color: (data['omzetDeltaPct'] as int) >= 0 ? ObbelTheme.primaryMedium : ObbelTheme.accentRed,
                                ),
                              ),
                            ],
                          ),
                        ],
                      ],
                    ),
                  ),
                  const SizedBox(height: 14),
                  Row(
                    children: [
                      Expanded(child: _pill(icon: Icons.local_cafe_outlined, value: '${data['cupSoldToday']}', label: 'Cup Terjual')),
                      const SizedBox(width: 10),
                      Expanded(child: _pill(icon: Icons.storefront_outlined, value: '${data['activeBoothsCount']}', label: 'Booth Aktif')),
                      const SizedBox(width: 10),
                      Expanded(
                        child: _pill(
                          icon: Icons.warning_amber_rounded,
                          value: '${data['attentionCount']}',
                          label: 'Perlu Perhatian',
                          isWarning: (data['attentionCount'] as int) > 0,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 24),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text('Perlu Perhatian', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w800, color: ObbelTheme.textDark)),
                    ],
                  ),
                  const SizedBox(height: 10),
                  _alertRow('Stok Menipis/Kritis/Habis', data['lowStockCount']),
                  _alertRow('Distribusi Pending', data['pendingDistributions']),
                  _alertRow('Restock Pending', data['pendingRestock']),
                  _alertRow('Return Pending', data['pendingReturns']),
                  _alertRow('Perlu Rekonsiliasi', data['reconciliationCasesOpen']),
                  const SizedBox(height: 24),
                  if (data['bestBooth'] != null) ...[
                    const Text('Booth Terbaik Hari Ini', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w800, color: ObbelTheme.textDark)),
                    const SizedBox(height: 10),
                    Container(
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: Colors.grey.shade200),
                      ),
                      child: Row(
                        children: [
                          const Text('🏆', style: TextStyle(fontSize: 28)),
                          const SizedBox(width: 14),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(data['bestBooth']['boothName'], style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 15, color: ObbelTheme.textDark)),
                                Text(_rupiah.format(data['bestBooth']['omzet']), style: const TextStyle(color: ObbelTheme.textLight, fontWeight: FontWeight.w600)),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ],
              ),
            ),
    );
  }

  Widget _pill({required IconData icon, required String value, required String label, bool isWarning = false}) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 8),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: isWarning ? ObbelTheme.accentOrange.withValues(alpha: 0.35) : Colors.grey.shade200),
      ),
      child: Column(
        children: [
          Icon(icon, color: isWarning ? ObbelTheme.accentOrange : ObbelTheme.primaryMedium, size: 22),
          const SizedBox(height: 6),
          Text(value, style: const TextStyle(fontFamily: 'Outfit', fontWeight: FontWeight.w900, fontSize: 18, color: ObbelTheme.textDark)),
          Text(label, textAlign: TextAlign.center, style: const TextStyle(fontSize: 11, color: ObbelTheme.textLight, fontWeight: FontWeight.w600)),
        ],
      ),
    );
  }

  Widget _alertRow(String label, int value) {
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: value > 0 ? const Color(0xFFFFF4E9) : Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: value > 0 ? const Color(0xFFFFDEC9) : Colors.grey.shade200),
      ),
      child: Row(
        children: [
          Icon(
            value > 0 ? Icons.warning_amber_rounded : Icons.check_circle_outline,
            color: value > 0 ? ObbelTheme.accentOrange : ObbelTheme.primaryMedium,
            size: 20,
          ),
          const SizedBox(width: 12),
          Expanded(child: Text(label, style: const TextStyle(fontWeight: FontWeight.w700, color: ObbelTheme.textDark, fontSize: 13))),
          Text('$value', style: const TextStyle(fontWeight: FontWeight.w900, color: ObbelTheme.textDark)),
        ],
      ),
    );
  }
}
