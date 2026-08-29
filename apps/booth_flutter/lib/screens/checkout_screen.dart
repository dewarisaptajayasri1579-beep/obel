import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../api_client.dart';
import '../app_state.dart';
import '../theme.dart';

class CheckoutScreen extends StatefulWidget {
  const CheckoutScreen({super.key});

  @override
  State<CheckoutScreen> createState() => _CheckoutScreenState();
}

class _CheckoutScreenState extends State<CheckoutScreen> {
  String _paymentMethod = 'Tunai'; // 'Tunai' or 'QRIS'
  bool _paying = false;

  Future<void> _pay() async {
    setState(() => _paying = true);
    try {
      await context.read<AppState>().checkout(_paymentMethod == 'Tunai' ? 'CASH' : 'QRIS');
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Pembayaran sukses! Mencetak nota...'),
          backgroundColor: ObbelTheme.primaryDark,
        ),
      );
      Navigator.popUntil(context, ModalRoute.withName('/home'));
    } on ApiException catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(e.message), backgroundColor: ObbelTheme.accentRed),
      );
    } finally {
      if (mounted) setState(() => _paying = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final appState = context.watch<AppState>();
    final cartItems = appState.cart;
    final subtotal = appState.cartTotal;
    const diskon = 0;
    final totalPayable = subtotal - diskon;

    return Scaffold(
      backgroundColor: ObbelTheme.backgroundLight,
      appBar: AppBar(
        title: const Text('Ringkasan Pesanan'),
      ),
      body: Column(
        children: [
          // Order summary items
          Expanded(
            child: ListView.builder(
              padding: const EdgeInsets.all(16),
              itemCount: cartItems.length,
              itemBuilder: (context, index) {
                final item = cartItems[index];
                return Container(
                  margin: const EdgeInsets.only(bottom: 10),
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Row(
                    children: [
                      // Coffee cup icon
                      Container(
                        padding: const EdgeInsets.all(8),
                        decoration: BoxDecoration(
                          color: ObbelTheme.backgroundLight,
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: const Icon(Icons.coffee, color: ObbelTheme.primaryDark),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              item.product.name,
                              style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
                            ),
                            Text('Rp ${item.product.price}'),
                          ],
                        ),
                      ),
                      Row(
                        children: [
                          IconButton(
                            onPressed: () => appState.decrementCartItem(item),
                            icon: const Icon(Icons.remove_circle_outline),
                            color: ObbelTheme.primaryMedium,
                          ),
                          Text(
                            '${item.quantity}',
                            style: const TextStyle(fontWeight: FontWeight.bold),
                          ),
                          IconButton(
                            onPressed: () => appState.incrementCartItem(item),
                            icon: const Icon(Icons.add_circle_outline),
                            color: ObbelTheme.primaryMedium,
                          ),
                        ],
                      )
                    ],
                  ),
                );
              },
            ),
          ),

          // Total billing summary & Payment methods
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
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  _buildBillingRow('Subtotal', 'Rp $subtotal'),
                  const SizedBox(height: 6),
                  _buildBillingRow('Diskon', 'Rp $diskon'),
                  const Divider(height: 20),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text(
                        'TOTAL BAYAR',
                        style: TextStyle(fontWeight: FontWeight.bold, fontSize: 15),
                      ),
                      Text(
                        'Rp $totalPayable',
                        style: const TextStyle(
                          fontWeight: FontWeight.w900,
                          fontSize: 22,
                          color: ObbelTheme.primaryDark,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 20),

                  const Text(
                    'Pilih Metode Pembayaran',
                    style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
                  ),
                  const SizedBox(height: 10),

                  // Toggle Payment Methods (Tunai/QRIS)
                  Row(
                    children: [
                      Expanded(
                        child: GestureDetector(
                          onTap: () {
                            setState(() {
                              _paymentMethod = 'Tunai';
                            });
                          },
                          child: Container(
                            padding: const EdgeInsets.symmetric(vertical: 14),
                            decoration: BoxDecoration(
                              color: _paymentMethod == 'Tunai'
                                  ? ObbelTheme.primaryMedium
                                  : ObbelTheme.backgroundLight,
                              borderRadius: BorderRadius.circular(12),
                            ),
                            child: Row(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Icon(
                                  Icons.money,
                                  color: _paymentMethod == 'Tunai' ? Colors.white : ObbelTheme.textDark,
                                ),
                                const SizedBox(width: 8),
                                Text(
                                  'Tunai',
                                  style: TextStyle(
                                    fontWeight: FontWeight.bold,
                                    color: _paymentMethod == 'Tunai' ? Colors.white : ObbelTheme.textDark,
                                  ),
                                )
                              ],
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: GestureDetector(
                          onTap: () {
                            setState(() {
                              _paymentMethod = 'QRIS';
                            });
                          },
                          child: Container(
                            padding: const EdgeInsets.symmetric(vertical: 14),
                            decoration: BoxDecoration(
                              color: _paymentMethod == 'QRIS'
                                  ? Colors.blue.shade700
                                  : ObbelTheme.backgroundLight,
                              borderRadius: BorderRadius.circular(12),
                            ),
                            child: Row(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Icon(
                                  Icons.qr_code,
                                  color: _paymentMethod == 'QRIS' ? Colors.white : ObbelTheme.textDark,
                                ),
                                const SizedBox(width: 8),
                                Text(
                                  'QRIS',
                                  style: TextStyle(
                                    fontWeight: FontWeight.bold,
                                    color: _paymentMethod == 'QRIS' ? Colors.white : ObbelTheme.textDark,
                                  ),
                                )
                              ],
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 20),

                  ElevatedButton(
                    onPressed: (cartItems.isEmpty || _paying) ? null : _pay,
                    child: _paying
                        ? const SizedBox(
                            width: 22,
                            height: 22,
                            child: CircularProgressIndicator(
                              color: Colors.white,
                              strokeWidth: 2.5,
                            ),
                          )
                        : const Text('BAYAR & PRINT NOTA'),
                  )
                ],
              ),
            ),
          )
        ],
      ),
    );
  }

  Widget _buildBillingRow(String label, String value) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(
          label,
          style: const TextStyle(color: ObbelTheme.textLight),
        ),
        Text(
          value,
          style: const TextStyle(fontWeight: FontWeight.bold, color: ObbelTheme.textDark),
        ),
      ],
    );
  }
}
