import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../app_state.dart';
import '../theme.dart';

class InboundScreen extends StatelessWidget {
  const InboundScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final appState = context.watch<AppState>();
    final items = appState.pendingInbound ?? [];
    final totalQty = items.fold(0, (sum, item) => sum + item.actualQty);

    return Scaffold(
      backgroundColor: ObbelTheme.backgroundLight,
      appBar: AppBar(
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => Navigator.pop(context),
        ),
        title: const Text('Terima Stok'),
      ),
      body: Column(
        children: [
          // Header info
          Container(
            color: Colors.white,
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const Center(
                  child: Text(
                    'Stok Masuk dari Gudang Pusat',
                    style: TextStyle(
                      fontWeight: FontWeight.bold,
                      fontSize: 16,
                      color: ObbelTheme.textDark,
                    ),
                  ),
                ),
                const SizedBox(height: 12),
                _buildInfoRow('Booth', 'Gallery Pandanaran'),
                const Divider(),
                _buildInfoRow('Shift', '1 (08.00 - 16.30)'),
                const Divider(),
                _buildInfoRow('Waktu Kirim', '07 Mei 2025 07:30'),
              ],
            ),
          ),
          const SizedBox(height: 8),

          // Items Label
          const Padding(
            padding: EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            child: Align(
              alignment: Alignment.centerLeft,
              child: Text(
                'Daftar Stok Masuk',
                style: TextStyle(
                  fontWeight: FontWeight.bold,
                  fontSize: 14,
                  color: ObbelTheme.textLight,
                ),
              ),
            ),
          ),

          // Item List
          Expanded(
            child: ListView.builder(
              itemCount: items.length,
              itemBuilder: (context, index) {
                final item = items[index];
                return Container(
                  margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Row(
                    children: [
                      // Coffee Icon Placeholder
                      Container(
                        padding: const EdgeInsets.all(8),
                        decoration: BoxDecoration(
                          color: ObbelTheme.backgroundLight,
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: const Icon(
                          Icons.local_cafe,
                          color: ObbelTheme.primaryDark,
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              item.product.name,
                              style: const TextStyle(
                                fontWeight: FontWeight.bold,
                                fontSize: 15,
                                color: ObbelTheme.textDark,
                              ),
                            ),
                            Text(
                              'Rp ${item.product.price}',
                              style: const TextStyle(
                                color: ObbelTheme.textLight,
                                fontSize: 13,
                              ),
                            ),
                          ],
                        ),
                      ),
                      // Decrement / Increment controls
                      Row(
                        children: [
                          IconButton(
                            onPressed: () => appState.updateInboundQty(
                              item,
                              item.actualQty - 1,
                            ),
                            icon: const Icon(Icons.remove_circle_outline),
                            color: ObbelTheme.primaryMedium,
                          ),
                          Text(
                            '${item.actualQty}',
                            style: const TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                          IconButton(
                            onPressed: () => appState.updateInboundQty(
                              item,
                              item.actualQty + 1,
                            ),
                            icon: const Icon(Icons.add_circle_outline),
                            color: ObbelTheme.primaryMedium,
                          ),
                        ],
                      ),
                    ],
                  ),
                );
              },
            ),
          ),

          // Bottom Buttons
          Container(
            padding: const EdgeInsets.all(16),
            decoration: const BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.only(
                topLeft: Radius.circular(16),
                topRight: Radius.circular(16),
              ),
            ),
            child: SafeArea(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text(
                        'Total',
                        style: TextStyle(
                          fontWeight: FontWeight.bold,
                          fontSize: 16,
                        ),
                      ),
                      Text(
                        '$totalQty cup',
                        style: const TextStyle(
                          fontWeight: FontWeight.bold,
                          fontSize: 18,
                          color: ObbelTheme.primaryDark,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  SizedBox(
                    width: double.infinity,
                    child: ElevatedButton(
                      onPressed: items.isEmpty
                          ? null
                          : () {
                              context.read<AppState>().receiveInbound();
                              ScaffoldMessenger.of(context).showSnackBar(
                                SnackBar(
                                  content: Text('Stok $totalQty cup berhasil diterima!'),
                                  backgroundColor: ObbelTheme.primaryDark,
                                ),
                              );
                              Navigator.pop(context);
                            },
                      child: Text('TERIMA $totalQty CUP'),
                    ),
                  ),
                  const SizedBox(height: 8),
                  SizedBox(
                    width: double.infinity,
                    child: OutlinedButton(
                      style: OutlinedButton.styleFrom(
                        side: const BorderSide(color: ObbelTheme.accentRed),
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                      ),
                      onPressed: () {
                        // Report discrepancy
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(
                            content: Text('Laporan selisih dikirim ke Admin.'),
                            backgroundColor: ObbelTheme.accentRed,
                          ),
                        );
                        Navigator.pop(context);
                      },
                      child: const Text(
                        'Tolak / Laporkan Selisih',
                        style: TextStyle(
                          color: ObbelTheme.accentRed,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          )
        ],
      ),
    );
  }

  Widget _buildInfoRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            label,
            style: const TextStyle(color: ObbelTheme.textLight, fontSize: 13),
          ),
          Text(
            value,
            style: const TextStyle(
              fontWeight: FontWeight.w600,
              color: ObbelTheme.textDark,
              fontSize: 13,
            ),
          ),
        ],
      ),
    );
  }
}
