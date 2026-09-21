import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../api_client.dart';
import '../app_state.dart';
import '../theme.dart';
import 'stock_screen.dart';

class ShiftScreen extends StatelessWidget {
  const ShiftScreen({super.key});

  Future<void> _confirmAndSubmitReturn(
    BuildContext context,
    AppState appState,
  ) async {
    final stockToReturn =
        appState.stock.where((s) => s.currentQty > 0).toList();

    final proceed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Kembalikan Stok'),
        content: SizedBox(
          width: double.maxFinite,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (stockToReturn.isEmpty)
                const Text('Tidak ada sisa stok untuk dikembalikan.')
              else ...[
                const Text(
                  'Sisa stok berikut akan dikembalikan ke Gudang Pusat:',
                ),
                const SizedBox(height: 8),
                for (final s in stockToReturn)
                  Padding(
                    padding: const EdgeInsets.symmetric(vertical: 2),
                    child: Text(
                      '${s.product.name}: ${s.currentQty} cup',
                    ),
                  ),
              ],
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('Batal'),
          ),
          ElevatedButton(
            onPressed: stockToReturn.isEmpty
                ? null
                : () => Navigator.of(context).pop(true),
            child: const Text('Ajukan'),
          ),
        ],
      ),
    );

    if (proceed != true || !context.mounted) return;

    try {
      await appState.submitReturn();

      if (!context.mounted) return;

      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Return diajukan, menunggu Admin menerima.'),
        ),
      );
    } on ApiException catch (e) {
      if (!context.mounted) return;

      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(e.message),
          backgroundColor: ObbelTheme.accentRed,
        ),
      );
    }
  }

  String _formatRupiah(dynamic value) {
    final number =
        value is num ? value : num.tryParse(value.toString()) ?? 0;

    final digits = number.round().abs().toString();
    final buffer = StringBuffer();

    for (var i = 0; i < digits.length; i++) {
      if (i > 0 && (digits.length - i) % 3 == 0) {
        buffer.write('.');
      }
      buffer.write(digits[i]);
    }

    return 'Rp $buffer';
  }

  @override
  Widget build(BuildContext context) {
    final appState = context.watch<AppState>();

    return Scaffold(
      backgroundColor: ObbelTheme.backgroundLight,
      appBar: PreferredSize(
        preferredSize: const Size.fromHeight(64),
        child: Container(
          width: double.infinity,
          color: const Color(0xFF07563D),
          alignment: Alignment.centerLeft,
          padding: const EdgeInsets.symmetric(horizontal: 18),
          child: const Text(
            'Ringkasan Shift',
            style: TextStyle(
              color: Colors.white,
              fontSize: 20,
              fontWeight: FontWeight.w800,
            ),
          ),
        ),
      ),
      body: SingleChildScrollView(
        child: Column(
          children: [
            Container(
              color: Colors.white,
              padding: const EdgeInsets.fromLTRB(16, 14, 16, 16),
              child: Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: ObbelTheme.primaryDark,
                  borderRadius: BorderRadius.circular(14),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Container(
                          width: 9,
                          height: 9,
                          decoration: const BoxDecoration(
                            color: Colors.greenAccent,
                            shape: BoxShape.circle,
                          ),
                        ),
                        const SizedBox(width: 8),
                        const Text(
                          'SHIFT AKTIF',
                          style: TextStyle(
                            color: Colors.white70,
                            fontSize: 11,
                            fontWeight: FontWeight.w700,
                            letterSpacing: 0.6,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            appState.shiftLabel,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                              color: Colors.white,
                              fontWeight: FontWeight.w800,
                              fontSize: 19,
                            ),
                          ),
                        ),
                        const SizedBox(width: 12),
                        Container(
                          padding: const EdgeInsets.all(9),
                          decoration: BoxDecoration(
                            color: Colors.white.withValues(alpha: 0.15),
                            borderRadius: BorderRadius.circular(10),
                          ),
                          child: const Icon(
                            Icons.schedule,
                            color: Colors.white,
                            size: 22,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 5),
                    Text(
                      appState.shiftTime,
                      style: const TextStyle(
                        color: Colors.white70,
                        fontSize: 13,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 8),
            Container(
              color: Colors.white,
              padding: const EdgeInsets.fromLTRB(16, 18, 16, 18),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const Text(
                    'Kinerja Shift',
                    style: TextStyle(
                      fontWeight: FontWeight.w800,
                      fontSize: 16,
                      color: ObbelTheme.textDark,
                    ),
                  ),
                  const SizedBox(height: 4),
                  const Text(
                    'Ringkasan penjualan selama shift berjalan',
                    style: TextStyle(
                      fontSize: 12,
                      color: ObbelTheme.textLight,
                    ),
                  ),
                  const SizedBox(height: 14),
                  Row(
                    children: [
                      Expanded(
                        child: _buildMetricItem(
                          Icons.payments_outlined,
                          'Omzet',
                          _formatRupiah(appState.omzetToday),
                          Colors.green.shade800,
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: _buildMetricItem(
                          Icons.coffee_outlined,
                          'Cup Terjual',
                          '${appState.cupSoldToday} cup',
                          Colors.blue.shade800,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 10),
                  Row(
                    children: [
                      Expanded(
                        child: _buildMetricItem(
                          Icons.receipt_long_outlined,
                          'Transaksi',
                          '${appState.transactionCount}',
                          ObbelTheme.primaryDark,
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: _buildMetricItem(
                          Icons.calculate_outlined,
                          'Rata-rata / Transaksi',
                          _formatRupiah(appState.averagePerTransaction),
                          ObbelTheme.accentOrange,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(height: 8),
            Container(
              color: Colors.white,
              padding: const EdgeInsets.fromLTRB(16, 18, 16, 18),
              width: double.infinity,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'Stok Saat Ini',
                    style: TextStyle(
                      fontWeight: FontWeight.w800,
                      fontSize: 16,
                      color: ObbelTheme.textDark,
                    ),
                  ),
                  const SizedBox(height: 4),
                  const Text(
                    'Jumlah stok yang masih tersedia di booth',
                    style: TextStyle(
                      fontSize: 12,
                      color: ObbelTheme.textLight,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Align(
                    alignment: Alignment.centerRight,
                    child: TextButton(
                      onPressed: () {
                        Navigator.of(context).push(
                          MaterialPageRoute(
                            builder: (_) => const StockScreen(),
                          ),
                        );
                      },
                      style: TextButton.styleFrom(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 4,
                          vertical: 4,
                        ),
                      ),
                      child: const Text(
                        'Lihat semua',
                        style: TextStyle(
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                  ),
                  if (appState.topStock.isEmpty)
                    const Padding(
                      padding: EdgeInsets.symmetric(vertical: 8),
                      child: Text(
                        'Belum ada data stok.',
                        style: TextStyle(
                          color: ObbelTheme.textLight,
                        ),
                      ),
                    )
                  else
                    for (final (i, s) in appState.topStock.indexed) ...[
                      if (i > 0) const Divider(height: 1),
                      _buildStockRow(
                        s.product.name,
                        '${s.currentQty} cup',
                      ),
                    ],
                ],
              ),
            ),
            const SizedBox(height: 8),
            Container(
              color: Colors.white,
              padding: const EdgeInsets.fromLTRB(16, 18, 16, 18),
              width: double.infinity,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'Top Penjualan',
                    style: TextStyle(
                      fontWeight: FontWeight.w800,
                      fontSize: 16,
                      color: ObbelTheme.textDark,
                    ),
                  ),
                  const SizedBox(height: 4),
                  const Text(
                    'Produk yang paling banyak terjual pada shift ini',
                    style: TextStyle(
                      fontSize: 12,
                      color: ObbelTheme.textLight,
                    ),
                  ),
                  const SizedBox(height: 12),
                  if (appState.topSelling.isEmpty)
                    const Padding(
                      padding: EdgeInsets.symmetric(vertical: 8),
                      child: Text(
                        'Belum ada penjualan pada shift ini.',
                        style: TextStyle(
                          color: ObbelTheme.textLight,
                        ),
                      ),
                    )
                  else
                    for (final (i, e) in appState.topSelling.indexed) ...[
                      if (i > 0) const Divider(height: 1),
                      _buildTopSaleRow(
                        '${i + 1}',
                        appState.productName(e.key),
                        '${e.value} cup',
                      ),
                    ],
                ],
              ),
            ),
            const SizedBox(height: 20),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Column(
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: ElevatedButton(
                          style: ElevatedButton.styleFrom(
                            backgroundColor: ObbelTheme.primaryDark,
                            foregroundColor: Colors.white,
                            padding: const EdgeInsets.symmetric(
                              vertical: 16,
                            ),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(12),
                            ),
                          ),
                          onPressed: () =>
                              Navigator.of(context).pushNamed('/closing'),
                          child: const Text(
                            'TUTUP SHIFT',
                            style: TextStyle(
                              fontWeight: FontWeight.w800,
                              fontSize: 14,
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: OutlinedButton(
                          style: OutlinedButton.styleFrom(
                            padding: const EdgeInsets.symmetric(
                              vertical: 14,
                            ),
                            side: const BorderSide(
                              color: ObbelTheme.accentOrange,
                            ),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(12),
                            ),
                          ),
                          onPressed: appState.submittingReturn
                              ? null
                              : () => _confirmAndSubmitReturn(
                                    context,
                                    appState,
                                  ),
                          child: appState.submittingReturn
                              ? const SizedBox(
                                  width: 18,
                                  height: 18,
                                  child: CircularProgressIndicator(
                                    strokeWidth: 2,
                                    color: ObbelTheme.accentOrange,
                                  ),
                                )
                              : const Text(
                                  'KEMBALIKAN STOK',
                                  textAlign: TextAlign.center,
                                  style: TextStyle(
                                    color: ObbelTheme.accentOrange,
                                    fontWeight: FontWeight.w800,
                                    fontSize: 13,
                                  ),
                                ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  Center(
                    child: TextButton(
                      style: TextButton.styleFrom(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 8,
                          vertical: 10,
                        ),
                        foregroundColor: Colors.red,
                      ),
                      onPressed: () {
                        context.read<AppState>().logout();
                        Navigator.of(context).pushNamedAndRemoveUntil(
                          '/login',
                          (route) => false,
                        );
                      },
                      child: const Text(
                        'KELUAR (LOGOUT)',
                        style: TextStyle(
                          color: Colors.red,
                          fontWeight: FontWeight.w800,
                          fontSize: 14,
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(height: 30),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildMetricItem(
    IconData icon,
    String label,
    String value,
    Color textColor,
  ) {
    return Container(
      padding: const EdgeInsets.all(13),
      decoration: BoxDecoration(
        color: ObbelTheme.backgroundLight,
        borderRadius: BorderRadius.circular(10),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(
                icon,
                size: 16,
                color: textColor,
              ),
              const SizedBox(width: 6),
              Expanded(
                child: Text(
                  label,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontSize: 11,
                    color: ObbelTheme.textLight,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 7),
          Text(
            value,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w800,
              color: textColor,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildStockRow(String name, String qty) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 11),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Expanded(
            child: Text(
              name,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                color: ObbelTheme.textDark,
                fontWeight: FontWeight.w600,
                fontSize: 14,
              ),
            ),
          ),
          const SizedBox(width: 8),
          Container(
            padding: const EdgeInsets.symmetric(
              horizontal: 10,
              vertical: 5,
            ),
            decoration: BoxDecoration(
              color: ObbelTheme.backgroundLight,
              borderRadius: BorderRadius.circular(8),
            ),
            child: Text(
              qty,
              style: const TextStyle(
                fontWeight: FontWeight.w800,
                color: ObbelTheme.accentOrange,
                fontSize: 13,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildTopSaleRow(
    String rank,
    String name,
    String qty,
  ) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 10),
      child: Row(
        children: [
          Container(
            width: 30,
            height: 30,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: ObbelTheme.backgroundLight,
              borderRadius: BorderRadius.circular(8),
            ),
            child: Text(
              rank,
              style: const TextStyle(
                fontWeight: FontWeight.w800,
                color: ObbelTheme.textDark,
              ),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              name,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                fontWeight: FontWeight.w700,
                color: ObbelTheme.textDark,
                fontSize: 14,
              ),
            ),
          ),
          const SizedBox(width: 8),
          Text(
            qty,
            style: const TextStyle(
              fontWeight: FontWeight.w800,
              color: ObbelTheme.primaryDark,
              fontSize: 13,
            ),
          ),
        ],
      ),
    );
  }
}