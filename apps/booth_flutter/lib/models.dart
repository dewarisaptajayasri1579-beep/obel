class Product {
  final String id;
  final String name;
  final int price;
  final String category;
  final String imagePath;

  const Product({
    required this.id,
    required this.name,
    required this.price,
    required this.category,
    required this.imagePath,
  });
}

class CartItem {
  final Product product;
  int quantity;

  CartItem({
    required this.product,
    this.quantity = 1,
  });

  int get totalPrice => product.price * quantity;
}

class InboundItem {
  final Product product;
  final int expectedQty;
  int actualQty;

  InboundItem({
    required this.product,
    required this.expectedQty,
    required this.actualQty,
  });
}

class ClosingCountItem {
  final String productId;
  final String productName;
  final int expectedQty;
  int actualQty;
  String? reasonCode;

  ClosingCountItem({
    required this.productId,
    required this.productName,
    required this.expectedQty,
    required this.actualQty,
    this.reasonCode,
  });

  int get discrepancy => actualQty - expectedQty;
}

class BoothStock {
  final Product product;
  int currentQty;
  final String status;

  BoothStock({
    required this.product,
    required this.currentQty,
    required this.status,
  });
}
