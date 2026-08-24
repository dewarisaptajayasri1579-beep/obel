import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/theme/app_colors.dart';
import '../../core/utils/formatters.dart';
import '../../data/repositories/app_data_controller.dart';
import '../../shared/models/cart_item.dart';
import '../../shared/widgets/quantity_stepper.dart';

class CartScreen extends ConsumerStatefulWidget {
  const CartScreen({super.key});

  @override
  ConsumerState<CartScreen> createState() => _CartScreenState();
}

class _CartScreenState extends ConsumerState<CartScreen> {
  PaymentMethod _method = PaymentMethod.cash;
  bool _paying = false;

  Future<void> _pay() async {
    setState(() => _paying = true);
    await Future.delayed(const Duration(milliseconds: 500));
    if (!mounted) return;

    final total = ref.read(appDataProvider.notifier).checkout();
    context.pop();
    context.push('/sale-success', extra: total);
  }

  @override
  Widget build(BuildContext context) {
    final data = ref.watch(appDataProvider);
    final cart = data.cart;

    if (cart.isEmpty) {
      return Scaffold(
        appBar: AppBar(title: const Text('Ringkasan Pesanan')),
        body: const Center(child: Text('Keranjang kosong.')),
      );
    }

    return Scaffold(
      appBar: AppBar(title: const Text('Ringkasan Pesanan')),
      body: Column(
        children: [
          Expanded(
            child: ListView(
              padding: const EdgeInsets.fromLTRB(20, 8, 20, 8),
              children: [
                for (final item in cart)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 14),
                    child: Row(
                      children: [
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                item.product.name,
                                style: const TextStyle(
                                    fontWeight: FontWeight.w700),
                              ),
                              Text(
                                formatRupiah(item.product.sellPrice),
                                style: const TextStyle(
                                  color: AppColors.textSecondary,
                                  fontSize: 12.5,
                                ),
                              ),
                            ],
                          ),
                        ),
                        QuantityStepper(
                          value: item.qty,
                          max: item.qty +
                              data.stockQtyFor(item.product.id) -
                              item.qty,
                          onChanged: (v) => ref
                              .read(appDataProvider.notifier)
                              .updateCartQty(item.product, v),
                        ),
                        SizedBox(
                          width: 44,
                          child: IconButton(
                            icon: const Icon(Icons.delete_outline_rounded,
                                color: AppColors.critical, size: 20),
                            onPressed: () => ref
                                .read(appDataProvider.notifier)
                                .updateCartQty(item.product, 0),
                          ),
                        ),
                      ],
                    ),
                  ),
                const Divider(),
                const SizedBox(height: 8),
                _SummaryRow(label: 'Subtotal', value: formatRupiah(data.cartTotal)),
                const _SummaryRow(label: 'Diskon', value: 'Rp0'),
                const Divider(),
                _SummaryRow(
                  label: 'Total',
                  value: formatRupiah(data.cartTotal),
                  bold: true,
                ),
                const SizedBox(height: 20),
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: AppColors.primaryLight,
                    borderRadius: BorderRadius.circular(14),
                  ),
                  child: Column(
                    children: [
                      const Text(
                        'TOTAL BAYAR',
                        style: TextStyle(
                          color: AppColors.textSecondary,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        formatRupiah(data.cartTotal),
                        style: const TextStyle(
                          fontSize: 26,
                          fontWeight: FontWeight.w800,
                          color: AppColors.primary,
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 20),
                const Text(
                  'Pilih Metode Pembayaran',
                  style: TextStyle(fontWeight: FontWeight.w700),
                ),
                const SizedBox(height: 10),
                Row(
                  children: [
                    Expanded(
                      child: _PaymentOption(
                        icon: Icons.payments_outlined,
                        label: 'Tunai',
                        selected: _method == PaymentMethod.cash,
                        onTap: () =>
                            setState(() => _method = PaymentMethod.cash),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: _PaymentOption(
                        icon: Icons.qr_code_rounded,
                        label: 'QRIS',
                        selected: _method == PaymentMethod.qris,
                        onTap: () =>
                            setState(() => _method = PaymentMethod.qris),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          Container(
            padding: const EdgeInsets.fromLTRB(20, 14, 20, 20),
            decoration: const BoxDecoration(
              color: AppColors.surface,
              border: Border(top: BorderSide(color: AppColors.border)),
            ),
            child: SafeArea(
              top: false,
              child: ElevatedButton(
                onPressed: _paying ? null : _pay,
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
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _SummaryRow extends StatelessWidget {
  const _SummaryRow({
    required this.label,
    required this.value,
    this.bold = false,
  });

  final String label;
  final String value;
  final bool bold;

  @override
  Widget build(BuildContext context) {
    final style = TextStyle(
      fontWeight: bold ? FontWeight.w800 : FontWeight.w500,
      fontSize: bold ? 16 : 14,
      color: bold ? AppColors.textPrimary : AppColors.textSecondary,
    );
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: style),
          Text(value, style: style),
        ],
      ),
    );
  }
}

class _PaymentOption extends StatelessWidget {
  const _PaymentOption({
    required this.icon,
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(14),
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 16),
        decoration: BoxDecoration(
          color: selected ? AppColors.primary : AppColors.surface,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(
            color: selected ? AppColors.primary : AppColors.border,
          ),
        ),
        child: Column(
          children: [
            Icon(icon, color: selected ? Colors.white : AppColors.textPrimary),
            const SizedBox(height: 6),
            Text(
              label,
              style: TextStyle(
                color: selected ? Colors.white : AppColors.textPrimary,
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
