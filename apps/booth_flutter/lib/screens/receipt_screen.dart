import 'package:flutter/material.dart';
import '../printing/receipt.dart';
import '../theme.dart';

class ReceiptScreen extends StatelessWidget {
  final Receipt receipt;

  const ReceiptScreen({
    super.key,
    required this.receipt,
  });

  String _formatRupiah(int value) {
    final digits = value.abs().toString();
    final buffer = StringBuffer();

    for (var i = 0; i < digits.length; i++) {
      if (i > 0 && (digits.length - i) % 3 == 0) {
        buffer.write('.');
      }

      buffer.write(digits[i]);
    }

    return 'Rp ${value < 0 ? '-' : ''}$buffer';
  }

  String _formatTime(DateTime time) {
    final hour = time.hour.toString().padLeft(2, '0');
    final minute = time.minute.toString().padLeft(2, '0');

    return '$hour:$minute';
  }

  String _paymentLabel(String value) {
    switch (value.toUpperCase()) {
      case 'CASH':
        return 'Tunai / Cash';
      case 'QRIS':
        return 'QRIS';
      default:
        return value;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: ObbelTheme.backgroundLight,
      body: SafeArea(
        child: Column(
          children: [
            _buildHeader(context),
            Expanded(
              child: SingleChildScrollView(
                padding: const EdgeInsets.all(16),
                child: Column(
                  children: [
                    _buildSuccessCard(),
                    const SizedBox(height: 16),
                    _buildReceiptCard(),
                  ],
                ),
              ),
            ),
            _buildBottomBar(context),
          ],
        ),
      ),
    );
  }

  Widget _buildHeader(BuildContext context) {
    return Container(
      width: double.infinity,
      color: Colors.white,
      padding: const EdgeInsets.fromLTRB(4, 8, 16, 14),
      child: Row(
        children: [
          IconButton(
            onPressed: () => Navigator.pop(context),
            icon: Icon(
              Icons.arrow_back,
              color: ObbelTheme.textDark,
            ),
          ),
          Expanded(
            child: Text(
              'Nota Pembayaran',
              style: TextStyle(
                color: ObbelTheme.textDark,
                fontSize: 20,
                fontWeight: FontWeight.w800,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSuccessCard() {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(
          color: const Color(0xFFE2E9ED),
        ),
      ),
      child: Column(
        children: [
          Container(
            width: 58,
            height: 58,
            decoration: BoxDecoration(
              color: const Color(0xFFEEF8F4),
              shape: BoxShape.circle,
            ),
            child: Icon(
              Icons.check_rounded,
              color: ObbelTheme.primaryDark,
              size: 34,
            ),
          ),
          const SizedBox(height: 12),
          Text(
            'Pembayaran Berhasil',
            style: TextStyle(
              color: ObbelTheme.textDark,
              fontSize: 18,
              fontWeight: FontWeight.w800,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            'Transaksi berhasil dicatat',
            style: TextStyle(
              color: ObbelTheme.textLight,
              fontSize: 13,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildReceiptCard() {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(
          color: const Color(0xFFE2E9ED),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Center(
            child: Column(
              children: [
                Text(
                  receipt.boothName.isNotEmpty
                      ? receipt.boothName
                      : 'OBBEL',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    color: ObbelTheme.textDark,
                    fontSize: 18,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  'NOTA PEMBAYARAN',
                  style: TextStyle(
                    color: ObbelTheme.textLight,
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 1,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 18),
          const Divider(
            color: Color(0xFFE2E9ED),
          ),
          const SizedBox(height: 12),
          _buildInfoRow(
            'No. Transaksi',
            '#${receipt.saleNo}',
          ),
          const SizedBox(height: 8),
          _buildInfoRow(
            'Waktu',
            _formatTime(receipt.time),
          ),
          const SizedBox(height: 8),
          _buildInfoRow(
            'Kasir',
            receipt.staffName?.isNotEmpty == true
                ? receipt.staffName!
                : 'Kasir',
          ),
          const SizedBox(height: 8),
          _buildInfoRow(
            'Pembayaran',
            _paymentLabel(receipt.paymentMethod),
          ),
          const SizedBox(height: 16),
          const Divider(
            color: Color(0xFFE2E9ED),
          ),
          const SizedBox(height: 12),
          Text(
            'DETAIL PESANAN',
            style: TextStyle(
              color: const Color(0xFF667991),
              fontSize: 12,
              fontWeight: FontWeight.w800,
              letterSpacing: 0.3,
            ),
          ),
          const SizedBox(height: 10),
          for (final item in receipt.items) ...[
            _buildItemRow(item),
            const SizedBox(height: 10),
          ],
          const Divider(
            color: Color(0xFFE2E9ED),
          ),
          const SizedBox(height: 12),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'TOTAL',
                style: TextStyle(
                  color: ObbelTheme.textDark,
                  fontSize: 14,
                  fontWeight: FontWeight.w800,
                ),
              ),
              Text(
                _formatRupiah(receipt.total),
                style: TextStyle(
                  color: ObbelTheme.primaryDark,
                  fontSize: 20,
                  fontWeight: FontWeight.w800,
                ),
              ),
            ],
          ),
          const SizedBox(height: 18),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: const Color(0xFFF6F9F8),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Text(
              'Terima kasih sudah berbelanja di Obbel.',
              textAlign: TextAlign.center,
              style: TextStyle(
                color: ObbelTheme.textLight,
                fontSize: 12,
                fontWeight: FontWeight.w500,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildInfoRow(
    String label,
    String value,
  ) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: TextStyle(
            color: ObbelTheme.textLight,
            fontSize: 12.5,
          ),
        ),
        const SizedBox(width: 16),
        Flexible(
          child: Text(
            value,
            textAlign: TextAlign.right,
            style: TextStyle(
              color: ObbelTheme.textDark,
              fontSize: 12.5,
              fontWeight: FontWeight.w700,
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildItemRow(ReceiptItem item) {
    final itemTotal = item.price * item.qty;

    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                item.name,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  color: ObbelTheme.textDark,
                  fontSize: 13.5,
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(height: 3),
              Text(
                '${item.qty} x ${_formatRupiah(item.price)}',
                style: TextStyle(
                  color: ObbelTheme.textLight,
                  fontSize: 12,
                ),
              ),
            ],
          ),
        ),
        const SizedBox(width: 12),
        Text(
          _formatRupiah(itemTotal),
          style: TextStyle(
            color: ObbelTheme.textDark,
            fontSize: 13,
            fontWeight: FontWeight.w700,
          ),
        ),
      ],
    );
  }

  Widget _buildBottomBar(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.fromLTRB(
        16,
        12,
        16,
        12,
      ),
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border(
          top: BorderSide(
            color: const Color(0xFFE2E9ED),
          ),
        ),
      ),
      child: SafeArea(
        top: false,
        child: SizedBox(
          width: double.infinity,
          child: ElevatedButton.icon(
            onPressed: () {
              Navigator.popUntil(
                context,
                ModalRoute.withName('/home'),
              );
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: ObbelTheme.primaryDark,
              foregroundColor: Colors.white,
              padding: const EdgeInsets.symmetric(
                vertical: 15,
              ),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(14),
              ),
            ),
            icon: const Icon(
              Icons.point_of_sale_rounded,
              size: 19,
            ),
            label: const Text(
              'KEMBALI KE POS',
              style: TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w800,
              ),
            ),
          ),
        ),
      ),
    );
  }
}