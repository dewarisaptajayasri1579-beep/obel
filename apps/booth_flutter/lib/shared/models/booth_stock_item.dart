import 'product.dart';
import 'stock_status.dart';

class BoothStockItem {
  const BoothStockItem({
    required this.product,
    required this.qtyOnHand,
    required this.minimumQty,
    required this.criticalQty,
  });

  final Product product;
  final int qtyOnHand;
  final int minimumQty;
  final int criticalQty;

  StockStatus get status => resolveStockStatus(
        qty: qtyOnHand,
        minimumQty: minimumQty,
        criticalQty: criticalQty,
      );

  BoothStockItem copyWith({int? qtyOnHand}) {
    return BoothStockItem(
      product: product,
      qtyOnHand: qtyOnHand ?? this.qtyOnHand,
      minimumQty: minimumQty,
      criticalQty: criticalQty,
    );
  }
}
