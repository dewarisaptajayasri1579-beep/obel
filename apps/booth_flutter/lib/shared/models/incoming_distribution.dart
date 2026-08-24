import 'product.dart';

class IncomingDistributionItem {
  const IncomingDistributionItem({
    required this.product,
    required this.qtySent,
    required this.qtyReceived,
  });

  final Product product;
  final int qtySent;
  final int qtyReceived;

  IncomingDistributionItem copyWith({int? qtyReceived}) {
    return IncomingDistributionItem(
      product: product,
      qtySent: qtySent,
      qtyReceived: qtyReceived ?? this.qtyReceived,
    );
  }
}

class IncomingDistribution {
  const IncomingDistribution({
    required this.id,
    required this.distributionNo,
    required this.boothName,
    required this.shiftLabel,
    required this.sentAt,
    required this.items,
  });

  final String id;
  final String distributionNo;
  final String boothName;
  final String shiftLabel;
  final DateTime sentAt;
  final List<IncomingDistributionItem> items;

  int get totalCup => items.fold(0, (sum, item) => sum + item.qtyReceived);
}
