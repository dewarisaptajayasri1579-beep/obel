import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../app_state.dart';
import '../theme.dart';

class ShiftScreen extends StatelessWidget {
  const ShiftScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final appState = context.watch<AppState>();
    return Scaffold(
      backgroundColor: ObbelTheme.backgroundLight,
      appBar: AppBar(
        title: const Text('Ringkasan Shift'),
      ),
      body: SingleChildScrollView(
        child: Column(
          children: [
            // Shift active info banner
            Container(
              color: Colors.white,
              padding: const EdgeInsets.all(16),
              child: Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: ObbelTheme.primaryDark,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          appState.shiftLabel,
                          style: const TextStyle(
                            color: Colors.white,
                            fontWeight: FontWeight.bold,
                            fontSize: 18,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          appState.shiftTime,
                          style: const TextStyle(color: Colors.white70, fontSize: 13),
                        ),
                      ],
                    ),
                    const Icon(Icons.schedule, color: Colors.white70, size: 36),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 8),

            // Performance metrics grid
            Container(
              color: Colors.white,
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const Text(
                    'Kinerja Shift Ini',
                    style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14, color: ObbelTheme.textLight),
                  ),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      Expanded(
                        child: _buildMetricItem('Omzet', 'Rp ${appState.omzetToday}', Colors.green.shade800),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: _buildMetricItem('Cup Terjual', '${appState.cupSoldToday} cup', Colors.blue.shade800),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      Expanded(
                        child: _buildMetricItem('Transaksi', '${appState.transactionCount}', ObbelTheme.primaryDark),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: _buildMetricItem(
                          'Rata-rata / Transaksi',
                          'Rp ${appState.averagePerTransaction}',
                          ObbelTheme.accentOrange,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(height: 8),

            // Stock recap summary
            Container(
              color: Colors.white,
              padding: const EdgeInsets.all(16),
              width: double.infinity,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text(
                        'Stok Saat Utama',
                        style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14, color: ObbelTheme.textLight),
                      ),
                      TextButton(
                        onPressed: () {},
                        child: const Text('Lihat semua stok'),
                      )
                    ],
                  ),
                  for (final s in appState.topStock)
                    _buildStockRow(s.product.name, '${s.currentQty} cup'),
                ],
              ),
            ),
            const SizedBox(height: 8),

            // Top Sales Products list
            Container(
              color: Colors.white,
              padding: const EdgeInsets.all(16),
              width: double.infinity,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'Top Penjualan',
                    style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14, color: ObbelTheme.textLight),
                  ),
                  const SizedBox(height: 12),
                  for (final (i, e) in appState.topSelling.indexed)
                    _buildTopSaleRow(
                      '${i + 1}',
                      appState.productName(e.key),
                      '${e.value} cup',
                    ),
                ],
              ),
            ),
            const SizedBox(height: 20),

            // Bottom Buttons
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16.0),
              child: Column(
                children: [
                  SizedBox(
                    width: double.infinity,
                    child: ElevatedButton(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: ObbelTheme.primaryDark,
                      ),
                      onPressed: () {
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(
                            content: Text('Menutup Shift. Melakukan Physical Count...'),
                            backgroundColor: ObbelTheme.primaryDark,
                          ),
                        );
                      },
                      child: const Text('TUTUP SHIFT'),
                    ),
                  ),
                  const SizedBox(height: 10),
                  SizedBox(
                    width: double.infinity,
                    child: OutlinedButton(
                      style: OutlinedButton.styleFrom(
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        side: const BorderSide(color: ObbelTheme.accentOrange),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                      ),
                      onPressed: () {},
                      child: const Text(
                        'KEMBALIKAN STOK',
                        style: TextStyle(
                          color: ObbelTheme.accentOrange,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(height: 10),
                  SizedBox(
                    width: double.infinity,
                    child: TextButton(
                      style: TextButton.styleFrom(
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        foregroundColor: Colors.redAccent,
                      ),
                      onPressed: () {
                        context.read<AppState>().logout();
                        Navigator.of(context).pushNamedAndRemoveUntil('/login', (route) => false);
                      },
                      child: const Text(
                        'KELUAR (LOGOUT)',
                        style: TextStyle(
                          fontWeight: FontWeight.bold,
                          fontSize: 15,
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(height: 30),
                ],
              ),
            )
          ],
        ),
      ),
    );
  }

  Widget _buildMetricItem(String label, String value, Color textColor) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: ObbelTheme.backgroundLight,
        borderRadius: BorderRadius.circular(8),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: const TextStyle(fontSize: 11, color: ObbelTheme.textLight)),
          const SizedBox(height: 4),
          Text(
            value,
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.bold,
              color: textColor,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildStockRow(String name, String qty) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8.0),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(name, style: const TextStyle(color: ObbelTheme.textDark, fontWeight: FontWeight.w500)),
          Text(qty, style: const TextStyle(fontWeight: FontWeight.bold, color: ObbelTheme.accentOrange)),
        ],
      ),
    );
  }

  Widget _buildTopSaleRow(String rank, String name, String qty) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8.0),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
            decoration: BoxDecoration(
              color: ObbelTheme.backgroundLight,
              borderRadius: BorderRadius.circular(6),
            ),
            child: Text(
              rank,
              style: const TextStyle(fontWeight: FontWeight.bold),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Text(name, style: const TextStyle(fontWeight: FontWeight.bold, color: ObbelTheme.textDark)),
          ),
          Text(qty, style: const TextStyle(fontWeight: FontWeight.bold, color: ObbelTheme.primaryDark)),
        ],
      ),
    );
  }
}
