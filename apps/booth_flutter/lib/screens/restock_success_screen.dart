import 'package:flutter/material.dart';

import '../theme.dart';
import 'restock_detail_screen.dart';
import 'stock_screen.dart';

// =====================================================================
// HELPER TAMPILAN STATUS (duplikat kecil, supaya file ini berdiri
// sendiri tanpa bergantung pada helper privat di stock_screen.dart)
// =====================================================================

Color _statusColorFor(String status) {
  switch (status) {
    case 'Habis':
      return Colors.red.shade600;
    case 'Kritis':
      return Colors.orange.shade800;
    case 'Menipis':
      return Colors.amber.shade800;
    case 'Aman':
      return Colors.green.shade700;
    default:
      return ObbelTheme.primaryDark;
  }
}

String _two(int v) => v.toString().padLeft(2, '0');

String _dateTimeLabel(DateTime d) {
  const bulan = [
    'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
    'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des',
  ];
  return '${d.day} ${bulan[d.month - 1]} ${d.year}, '
      '${_two(d.hour)}:${_two(d.minute)} WIB';
}

// =====================================================================
// SCREEN
// =====================================================================

/// Ditampilkan setelah user menekan "Kirim Pengajuan Restock" di
/// RestockDetailScreen. Berisi ringkasan pengajuan yang baru dikirim:
/// nomor pengajuan, waktu, status, dan daftar produk + jumlahnya.
class RestockSuccessScreen extends StatelessWidget {
  final String requestId;
  final DateTime submittedAt;
  final List<DummyRestockItem> items;
  final Map<String, int> quantities;

  const RestockSuccessScreen({
    super.key,
    required this.requestId,
    required this.submittedAt,
    required this.items,
    required this.quantities,
  });

  int get _totalQuantity {
    return quantities.values.fold(0, (total, value) => total + value);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: ObbelTheme.backgroundLight,
      appBar: AppBar(
        automaticallyImplyLeading: false,
        title: const Text('Pengajuan Restock'),
      ),
      body: Column(
        children: [
          Expanded(
            child: ListView(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
              children: [
                _buildSuccessHeader(),
                const SizedBox(height: 16),
                _buildRequestInfoCard(),
                const SizedBox(height: 16),
                _buildSummaryRow(),
                const SizedBox(height: 20),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text(
                      'Detail Produk Diajukan',
                      style: TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.w800,
                        color: ObbelTheme.textDark,
                      ),
                    ),
                    Text(
                      '${items.length} Produk',
                      style: const TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                        color: ObbelTheme.textLight,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 10),
                for (final item in items) ...[
                  _buildItemCard(item),
                  const SizedBox(height: 10),
                ],
                const SizedBox(height: 8),
                _buildNextStepsCard(),
                const SizedBox(height: 16),
              ],
            ),
          ),
          _buildBottomButtons(context),
        ],
      ),
    );
  }

  // ===================================================================
  // HEADER SUKSES
  // ===================================================================

  Widget _buildSuccessHeader() {
    return Column(
      children: [
        Container(
          width: 72,
          height: 72,
          decoration: const BoxDecoration(
            color: Color(0xFFE8F5E9),
            shape: BoxShape.circle,
          ),
          child: const Icon(
            Icons.check_circle,
            color: ObbelTheme.primaryDark,
            size: 44,
          ),
        ),
        const SizedBox(height: 14),
        const Text(
          'Pengajuan Restock Terkirim!',
          textAlign: TextAlign.center,
          style: TextStyle(
            fontFamily: 'Outfit',
            fontSize: 18,
            fontWeight: FontWeight.w900,
            color: ObbelTheme.textDark,
          ),
        ),
        const SizedBox(height: 6),
        Text(
          'Pengajuan sedang menunggu persetujuan supervisor booth.',
          textAlign: TextAlign.center,
          style: TextStyle(
            fontSize: 12,
            color: Colors.grey.shade600,
            height: 1.4,
          ),
        ),
      ],
    );
  }

  // ===================================================================
  // KARTU INFO PENGAJUAN
  // ===================================================================

  Widget _buildRequestInfoCard() {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: Colors.grey.shade200, width: 1.2),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text(
                'No. Pengajuan',
                style: TextStyle(fontSize: 12, color: ObbelTheme.textLight),
              ),
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 10,
                  vertical: 4,
                ),
                decoration: BoxDecoration(
                  color: Colors.amber.shade50,
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(color: Colors.amber.shade200),
                ),
                child: Text(
                  'Menunggu Persetujuan',
                  style: TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.w800,
                    color: Colors.amber.shade800,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 4),
          Text(
            requestId,
            style: const TextStyle(
              fontFamily: 'Outfit',
              fontSize: 18,
              fontWeight: FontWeight.w900,
              color: ObbelTheme.textDark,
            ),
          ),
          const SizedBox(height: 12),
          Divider(height: 1, color: Colors.grey.shade100),
          const SizedBox(height: 12),
          Row(
            children: [
              Icon(Icons.access_time, size: 14, color: Colors.grey.shade500),
              const SizedBox(width: 6),
              Text(
                'Diajukan ${_dateTimeLabel(submittedAt)}',
                style: TextStyle(fontSize: 11, color: Colors.grey.shade600),
              ),
            ],
          ),
          const SizedBox(height: 6),
          Row(
            children: [
              Icon(Icons.storefront_outlined, size: 14, color: Colors.grey.shade500),
              const SizedBox(width: 6),
              Text(
                'Booth 1 • Cabang Mall Citra',
                style: TextStyle(fontSize: 11, color: Colors.grey.shade600),
              ),
            ],
          ),
        ],
      ),
    );
  }

  // ===================================================================
  // RINGKASAN
  // ===================================================================

  Widget _buildSummaryRow() {
    return Row(
      children: [
        Expanded(
          child: _buildSummaryTile(
            icon: Icons.inventory_2_outlined,
            iconBg: const Color(0xFFE8F5E9),
            iconColor: ObbelTheme.primaryDark,
            label: 'Total Produk',
            value: '${items.length} SKU',
          ),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: _buildSummaryTile(
            icon: Icons.shopping_cart_outlined,
            iconBg: const Color(0xFFE8F5E9),
            iconColor: ObbelTheme.primaryDark,
            label: 'Total Unit Diajukan',
            value: '$_totalQuantity unit',
          ),
        ),
      ],
    );
  }

  Widget _buildSummaryTile({
    required IconData icon,
    required Color iconBg,
    required Color iconColor,
    required String label,
    required String value,
  }) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: Colors.grey.shade200, width: 1.2),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.all(6),
            decoration: BoxDecoration(
              color: iconBg,
              borderRadius: BorderRadius.circular(8),
            ),
            child: Icon(icon, size: 16, color: iconColor),
          ),
          const SizedBox(height: 8),
          Text(
            label,
            style: const TextStyle(fontSize: 11, color: ObbelTheme.textLight),
          ),
          const SizedBox(height: 2),
          Text(
            value,
            style: const TextStyle(
              fontFamily: 'Outfit',
              fontSize: 17,
              fontWeight: FontWeight.w900,
              color: ObbelTheme.textDark,
            ),
          ),
        ],
      ),
    );
  }

  // ===================================================================
  // KARTU PRODUK
  // ===================================================================

  Widget _buildItemCard(DummyRestockItem item) {
    final color = _statusColorFor(item.status);
    final qty = quantities[item.id] ?? item.initialQuantity;

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: color.withValues(alpha: 0.3), width: 1.2),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 8,
                        vertical: 3,
                      ),
                      decoration: BoxDecoration(
                        color: color.withValues(alpha: 0.10),
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: Text(
                        item.status,
                        style: TextStyle(
                          fontSize: 10,
                          fontWeight: FontWeight.w700,
                          color: color,
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Flexible(
                      child: Text(
                        'SKU: ${item.sku}',
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          fontSize: 10,
                          color: ObbelTheme.textLight,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 6),
                Text(
                  item.name,
                  style: const TextStyle(
                    fontFamily: 'Outfit',
                    fontWeight: FontWeight.w800,
                    fontSize: 14,
                    color: ObbelTheme.textDark,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  'Satuan: ${item.unit}',
                  style: const TextStyle(
                    fontSize: 11,
                    color: ObbelTheme.textLight,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            decoration: BoxDecoration(
              color: ObbelTheme.backgroundLight,
              borderRadius: BorderRadius.circular(10),
            ),
            child: Text(
              '+$qty',
              style: const TextStyle(
                fontFamily: 'Outfit',
                fontWeight: FontWeight.w900,
                fontSize: 16,
                color: ObbelTheme.primaryDark,
              ),
            ),
          ),
        ],
      ),
    );
  }

  // ===================================================================
  // LANGKAH SELANJUTNYA
  // ===================================================================

  Widget _buildNextStepsCard() {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFFF1F5FF),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFFD8E1F0)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Icon(Icons.info_outline, color: ObbelTheme.primaryDark, size: 20),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Langkah Selanjutnya',
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w800,
                    color: ObbelTheme.primaryDark,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  'Supervisor akan meninjau pengajuan ini. Kamu bisa memantau '
                  'statusnya lewat "Riwayat Stok" di halaman Stok Booth.',
                  style: TextStyle(
                    fontSize: 11,
                    color: Colors.grey.shade700,
                    height: 1.4,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  // ===================================================================
  // TOMBOL BAWAH
  // ===================================================================

  Widget _buildBottomButtons(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(16, 10, 16, 12),
      decoration: BoxDecoration(
        color: Colors.white,
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.08),
            blurRadius: 10,
            offset: const Offset(0, -3),
          ),
        ],
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          SizedBox(
            width: double.infinity,
            child: ElevatedButton.icon(
              onPressed: () {
                // Kembali ke halaman Stok Booth yang paling awal
                // (buang semua halaman restock di atasnya).
                Navigator.popUntil(
                  context,
                  (route) => route.isFirst || route.settings.name == '/stock',
                );
              },
              style: ElevatedButton.styleFrom(
                backgroundColor: ObbelTheme.primaryDark,
                padding: const EdgeInsets.symmetric(vertical: 14),
                elevation: 0,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(11),
                ),
              ),
              icon: const Icon(Icons.inventory_2_outlined, color: Colors.white, size: 18),
              label: const Text(
                'Kembali ke Stok Booth',
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w800,
                  color: Colors.white,
                ),
              ),
            ),
          ),
          const SizedBox(height: 8),
          SizedBox(
            width: double.infinity,
            child: OutlinedButton.icon(
              onPressed: () {
                Navigator.pushReplacement(
                  context,
                  MaterialPageRoute(builder: (_) => const StockScreen()),
                );
              },
              style: OutlinedButton.styleFrom(
                padding: const EdgeInsets.symmetric(vertical: 13),
                side: BorderSide(color: Colors.grey.shade300),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(10),
                ),
              ),
              icon: const Icon(
                Icons.add_shopping_cart_outlined,
                size: 16,
                color: ObbelTheme.textDark,
              ),
              label: const Text(
                'Buat Pengajuan Restock Baru',
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                  color: ObbelTheme.textDark,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}