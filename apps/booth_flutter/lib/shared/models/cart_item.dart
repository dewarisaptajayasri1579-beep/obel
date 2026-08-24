import 'product.dart';

class CartItem {
  const CartItem({required this.product, required this.qty});

  final Product product;
  final int qty;

  int get lineTotal => product.sellPrice * qty;

  CartItem copyWith({int? qty}) {
    return CartItem(product: product, qty: qty ?? this.qty);
  }
}

enum PaymentMethod { cash, qris }

extension PaymentMethodLabel on PaymentMethod {
  String get label {
    switch (this) {
      case PaymentMethod.cash:
        return 'Tunai';
      case PaymentMethod.qris:
        return 'QRIS';
    }
  }
}
