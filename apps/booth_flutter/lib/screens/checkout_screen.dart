import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../api_client.dart';
import '../app_state.dart';
import '../printing/bluetooth_receipt_printer.dart';
import '../printing/receipt.dart';
import '../theme.dart';
import 'receipt_screen.dart';

class _CheckoutAccent {
  static const mintBg = Color(0xFFEEF8F4);
  static const surfaceMuted = Color(0xFFF6F9F8);
  static const border = Color(0xFFE2E9ED);
  static const textMuted = Color(0xFF667991);
  static const textHint = Color(0xFF8FA1B5);
}

class CheckoutScreen extends StatefulWidget {
  const CheckoutScreen({super.key});

  @override
  State<CheckoutScreen> createState() => _CheckoutScreenState();
}

class _CheckoutScreenState extends State<CheckoutScreen> {
  String _paymentMethod = 'Tunai';
  bool _paying = false;

  bool _autoPrint = true;

  Future<void> _pay() async {
    setState(() => _paying = true);
    final appState = context.read<AppState>();
    final boothName = appState.boothName;
    final staffName = appState.staffName;
    CompletedSale? sale;
    try {
      sale = await appState.checkout(
        _paymentMethod == 'Tunai' ? 'CASH' : 'QRIS',
      );
    } on ApiException catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(e.message),
          backgroundColor: ObbelTheme.accentRed,
        ),
      );
      return;
    } finally {
      if (mounted) setState(() => _paying = false);
    }

    final receipt = Receipt(
      boothName: boothName,
      saleNo: sale.saleNo,
      time: DateTime.now(),
      items: sale.items
          .map(
            (i) => ReceiptItem(
              name: i.name,
              qty: i.qty,
              price: i.price,
            ),
          )
          .toList(),
      total: sale.total,
      paymentMethod: _paymentMethod,
      staffName: staffName,
    );

    if (!mounted) return;

    ScaffoldMessenger.of(context).clearSnackBars();

    await Navigator.pushReplacement(
      context,
      MaterialPageRoute(
        builder: (_) => ReceiptScreen(
          receipt: receipt,
        ),
      ),
    );
  }

  Future<String?> _loadPrinterLabel() async {
    try {
      final preferred =
          await BluetoothReceiptPrinter.loadPreferred();

      if (preferred == null) return null;

      try {
        final dynamic p = preferred;
        final name = p.name ?? p.deviceName;

        if (name != null) {
          return name.toString();
        }
      } catch (_) {}

      return preferred.toString();
    } catch (_) {
      return null;
    }
  }

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

  @override
  Widget build(BuildContext context) {
    final appState = context.watch<AppState>();
    final cartItems = appState.cart;
    final subtotal = appState.cartTotal;
    const diskon = 0;
    final totalPayable = subtotal - diskon;

    final itemCount = cartItems.fold<int>(
      0,
      (sum, i) => sum + i.quantity,
    );

    final canPay = cartItems.isNotEmpty && !_paying;

    return Scaffold(
      backgroundColor: ObbelTheme.backgroundLight,
      body: SafeArea(
        child: Column(
          children: [
            _buildHeader(appState, itemCount),
            Expanded(
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  _buildOrderCard(
                    cartItems,
                    appState,
                    subtotal,
                    diskon,
                    totalPayable,
                  ),
                  const SizedBox(height: 20),
                  _buildPaymentMethodSection(),
                  const SizedBox(height: 20),
                  _buildPrinterSection(),
                ],
              ),
            ),
            _buildBottomBar(totalPayable, canPay),
          ],
        ),
      ),
    );
  }

  Widget _buildHeader(
    AppState appState,
    int itemCount,
  ) {
    final staffName = appState.staffName;
    final boothName = appState.boothName;

    final initials =
        (staffName.isNotEmpty ? staffName.trim() : 'K')
            .split(RegExp(r'\s+'))
            .map((w) => w.isNotEmpty ? w[0] : '')
            .take(2)
            .join()
            .toUpperCase();

    return Container(
      width: double.infinity,
      color: Colors.white,
      padding: const EdgeInsets.fromLTRB(4, 8, 16, 14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
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
                  'Detail Pesanan',
                  style: TextStyle(
                    color: ObbelTheme.textDark,
                    fontSize: 20,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 10,
                  vertical: 6,
                ),
                decoration: BoxDecoration(
                  color: _CheckoutAccent.surfaceMuted,
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(
                    color: _CheckoutAccent.border,
                  ),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    CircleAvatar(
                      radius: 11,
                      backgroundColor:
                          ObbelTheme.primaryDark,
                      child: Text(
                        initials.isEmpty ? 'K' : initials,
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 10,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                    ),
                    const SizedBox(width: 6),
                    Text(
                      staffName.isNotEmpty ? staffName : 'Kasir',
                      style: TextStyle(
                        color: ObbelTheme.textDark,
                        fontSize: 12.5,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          Padding(
            padding: const EdgeInsets.only(
              left: 56,
              top: 2,
            ),
            child: Text(
              boothName.isNotEmpty
                  ? '$boothName • $itemCount item'
                  : '$itemCount item di keranjang',
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                color: ObbelTheme.textLight,
                fontSize: 13,
                fontWeight: FontWeight.w500,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildOrderCard(
    List<dynamic> cartItems,
    AppState appState,
    int subtotal,
    int diskon,
    int totalPayable,
  ) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(
          color: _CheckoutAccent.border,
        ),
      ),
      child: Column(
        children: [
          for (var i = 0; i < cartItems.length; i++) ...[
            if (i > 0)
              const Divider(
                height: 1,
                color: _CheckoutAccent.border,
              ),
            _buildOrderItemRow(
              cartItems[i],
              appState,
            ),
          ],
          if (cartItems.isEmpty)
            const Padding(
              padding: EdgeInsets.all(20),
              child: Text(
                'Keranjang masih kosong.',
              ),
            ),
          Padding(
            padding: const EdgeInsets.all(14),
            child: Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: _CheckoutAccent.surfaceMuted,
                borderRadius: BorderRadius.circular(14),
              ),
              child: Column(
                crossAxisAlignment:
                    CrossAxisAlignment.stretch,
                children: [
                  _buildBillingRow(
                    'Subtotal',
                    _formatRupiah(subtotal),
                  ),
                  if (diskon > 0) ...[
                    const SizedBox(height: 6),
                    _buildBillingRow(
                      'Diskon',
                      '- ${_formatRupiah(diskon)}',
                    ),
                  ],
                  const SizedBox(height: 10),
                  const Divider(
                    height: 1,
                    color: _CheckoutAccent.border,
                  ),
                  const SizedBox(height: 10),
                  Row(
                    mainAxisAlignment:
                        MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        'TOTAL TAGIHAN',
                        style: TextStyle(
                          color: _CheckoutAccent.textMuted,
                          fontSize: 12.5,
                          fontWeight: FontWeight.w700,
                          letterSpacing: 0.3,
                        ),
                      ),
                      Text(
                        _formatRupiah(totalPayable),
                        style: TextStyle(
                          fontWeight: FontWeight.w800,
                          fontSize: 22,
                          color: ObbelTheme.primaryDark,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildOrderItemRow(
    dynamic item,
    AppState appState,
  ) {
    return Padding(
      padding: const EdgeInsets.all(12),
      child: Row(
        children: [
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: _CheckoutAccent.mintBg,
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(
              Icons.coffee_outlined,
              color: ObbelTheme.primaryDark,
              size: 22,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment:
                  CrossAxisAlignment.start,
              children: [
                Text(
                  '${item.product.name}',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    color: ObbelTheme.textDark,
                    fontWeight: FontWeight.w700,
                    fontSize: 14,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  '${item.quantity}x @ ${_formatRupiah(item.product.price.round())}',
                  style: TextStyle(
                    color: ObbelTheme.textLight,
                    fontSize: 12.5,
                  ),
                ),
              ],
            ),
          ),
          Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              IconButton(
                onPressed: () =>
                    appState.decrementCartItem(item),
                icon: const Icon(
                  Icons.remove_circle_outline,
                ),
                color: ObbelTheme.primaryMedium,
                visualDensity: VisualDensity.compact,
              ),
              Text(
                '${item.quantity}',
                style: TextStyle(
                  fontWeight: FontWeight.w800,
                  color: ObbelTheme.textDark,
                ),
              ),
              IconButton(
                onPressed: () =>
                    appState.incrementCartItem(item),
                icon: const Icon(
                  Icons.add_circle_outline,
                ),
                color: ObbelTheme.primaryMedium,
                visualDensity: VisualDensity.compact,
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildBillingRow(
    String label,
    String value,
  ) {
    return Row(
      mainAxisAlignment:
          MainAxisAlignment.spaceBetween,
      children: [
        Text(
          label,
          style: TextStyle(
            color: ObbelTheme.textLight,
            fontSize: 13,
          ),
        ),
        Text(
          value,
          style: TextStyle(
            fontWeight: FontWeight.w700,
            color: ObbelTheme.textDark,
            fontSize: 13,
          ),
        ),
      ],
    );
  }

  Widget _buildPaymentMethodSection() {
    return Column(
      crossAxisAlignment:
          CrossAxisAlignment.start,
      children: [
        Text(
          'PILIH METODE PEMBAYARAN',
          style: TextStyle(
            color: _CheckoutAccent.textMuted,
            fontSize: 12.5,
            fontWeight: FontWeight.w700,
            letterSpacing: 0.3,
          ),
        ),
        const SizedBox(height: 10),
        Center(
          child: Row(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _buildPaymentOption(
                value: 'Tunai',
                label: 'Tunai / Cash',
                icon: Icons.payments_outlined,
              ),
              const SizedBox(width: 12),
              _buildPaymentOption(
                value: 'QRIS',
                label: 'QRIS Statis/Dinamis',
                icon: Icons.qr_code_2_rounded,
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildPaymentOption({
    required String value,
    required String label,
    required IconData icon,
  }) {
    final selected = _paymentMethod == value;

    return SizedBox(
      width: 140,
      height: 112,
      child: GestureDetector(
        onTap: () {
          setState(() {
            _paymentMethod = value;
          });
        },
        child: Stack(
          children: [
            Container(
              width: double.infinity,
              height: double.infinity,
              padding: const EdgeInsets.symmetric(
                horizontal: 8,
                vertical: 16,
              ),
              decoration: BoxDecoration(
                color: selected
                    ? _CheckoutAccent.mintBg
                    : Colors.white,
                borderRadius:
                    BorderRadius.circular(16),
                border: Border.all(
                  color: selected
                      ? ObbelTheme.primaryDark
                      : _CheckoutAccent.border,
                  width: selected ? 1.6 : 1,
                ),
              ),
              child: Column(
                mainAxisAlignment:
                    MainAxisAlignment.center,
                children: [
                  Icon(
                    icon,
                    size: 26,
                    color: selected
                        ? ObbelTheme.primaryDark
                        : ObbelTheme.textDark,
                  ),
                  const SizedBox(height: 8),
                  Text(
                    label,
                    textAlign: TextAlign.center,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      fontWeight: FontWeight.w800,
                      fontSize: 14,
                      color: selected
                          ? ObbelTheme.primaryDark
                          : ObbelTheme.textDark,
                    ),
                  ),
                ],
              ),
            ),
            if (selected)
              Positioned(
                top: 10,
                right: 10,
                child: Container(
                  width: 20,
                  height: 20,
                  decoration: BoxDecoration(
                    color: ObbelTheme.primaryDark,
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(
                    Icons.check,
                    color: Colors.white,
                    size: 12,
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }

  Widget _buildPrinterSection() {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: _CheckoutAccent.border,
        ),
      ),
      child: Column(
        children: [
          Row(
            children: [
              Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  color: _CheckoutAccent.mintBg,
                  borderRadius:
                      BorderRadius.circular(10),
                ),
                child: Icon(
                  Icons.print_outlined,
                  color: ObbelTheme.primaryDark,
                  size: 20,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: FutureBuilder<String?>(
                  future: _loadPrinterLabel(),
                  builder: (context, snapshot) {
                    final loading =
                        snapshot.connectionState ==
                            ConnectionState.waiting;
                    final label = snapshot.data;

                    return Column(
                      crossAxisAlignment:
                          CrossAxisAlignment.start,
                      children: [
                        Text(
                          loading
                              ? 'Memeriksa printer...'
                              : (label ??
                                  'Printer belum diatur'),
                          maxLines: 1,
                          overflow:
                              TextOverflow.ellipsis,
                          style: TextStyle(
                            fontWeight:
                                FontWeight.w700,
                            fontSize: 14,
                            color:
                                ObbelTheme.textDark,
                          ),
                        ),
                        Text(
                          loading
                              ? 'Mohon tunggu'
                              : (label != null
                                  ? 'Siap mencetak'
                                  : 'Atur printer di menu Pengaturan'),
                          style: TextStyle(
                            fontSize: 12,
                            color:
                                ObbelTheme.textLight,
                          ),
                        ),
                      ],
                    );
                  },
                ),
              ),
              Switch(
                value: _autoPrint,
                activeThumbColor:
                    ObbelTheme.primaryDark,
                onChanged: (value) {
                  setState(() {
                    _autoPrint = value;
                  });
                },
              ),
            ],
          ),
          const Divider(
            height: 20,
            color: _CheckoutAccent.border,
          ),
          Row(
            mainAxisAlignment:
                MainAxisAlignment.spaceBetween,
            children: [
              Row(
                children: [
                  Icon(
                    Icons.sync,
                    size: 15,
                    color: ObbelTheme.textLight,
                  ),
                  const SizedBox(width: 6),
                  Text(
                    'Cetak Nota Otomatis Setelah Bayar',
                    style: TextStyle(
                      fontSize: 12.5,
                      color: ObbelTheme.textLight,
                    ),
                  ),
                ],
              ),
              Text(
                _autoPrint ? 'AKTIF' : 'MATI',
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w800,
                  color: _autoPrint
                      ? ObbelTheme.primaryDark
                      : _CheckoutAccent.textHint,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildBottomBar(
    int totalPayable,
    bool canPay,
  ) {
    return Container(
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
            color: _CheckoutAccent.border,
          ),
        ),
      ),
      child: SafeArea(
        top: false,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: canPay ? _pay : null,
                style: ElevatedButton.styleFrom(
                  backgroundColor:
                      ObbelTheme.primaryDark,
                  disabledBackgroundColor:
                      _CheckoutAccent.textHint,
                  padding:
                      const EdgeInsets.symmetric(
                    vertical: 16,
                  ),
                  shape:
                      RoundedRectangleBorder(
                    borderRadius:
                        BorderRadius.circular(14),
                  ),
                ),
                child: _paying
                    ? const SizedBox(
                        width: 22,
                        height: 22,
                        child:
                            CircularProgressIndicator(
                          color: Colors.white,
                          strokeWidth: 2.5,
                        ),
                      )
                    : Row(
                        mainAxisAlignment:
                            MainAxisAlignment.center,
                        children: [
                          Icon(
                            _autoPrint
                                ? Icons.print
                                : Icons
                                    .check_circle_outline,
                            color: Colors.white,
                            size: 18,
                          ),
                          const SizedBox(width: 8),
                          Text(
                            _autoPrint
                                ? 'BAYAR & CETAK NOTA'
                                : 'BAYAR',
                            style:
                                const TextStyle(
                              color: Colors.white,
                              fontWeight:
                                  FontWeight.w800,
                              fontSize: 15,
                            ),
                          ),
                          const SizedBox(width: 10),
                          Container(
                            padding:
                                const EdgeInsets
                                    .symmetric(
                              horizontal: 10,
                              vertical: 4,
                            ),
                            decoration: BoxDecoration(
                              color: Colors.white
                                  .withValues(
                                alpha: 0.18,
                              ),
                              borderRadius:
                                  BorderRadius.circular(
                                10,
                              ),
                            ),
                            child: Text(
                              _formatRupiah(
                                totalPayable,
                              ),
                              style:
                                  const TextStyle(
                                color: Colors.white,
                                fontWeight:
                                    FontWeight.w800,
                                fontSize: 13,
                              ),
                            ),
                          ),
                        ],
                      ),
              ),
            ),
            const SizedBox(height: 8),
            SizedBox(
              width: double.infinity,
              child: OutlinedButton.icon(
                onPressed: _paying
                    ? null
                    : () => Navigator.pop(context),
                style:
                    OutlinedButton.styleFrom(
                  foregroundColor:
                      ObbelTheme.textLight,
                  side: BorderSide(
                    color: _CheckoutAccent.border,
                  ),
                  padding:
                      const EdgeInsets.symmetric(
                    vertical: 12,
                  ),
                  shape:
                      RoundedRectangleBorder(
                    borderRadius:
                        BorderRadius.circular(14),
                  ),
                ),
                icon: const Icon(
                  Icons.arrow_back,
                  size: 16,
                ),
                label: const Text(
                  'Batal / Kembali ke POS',
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}