/// Model struk untuk dicetak — field minimum sesuai
/// docs/obbel-coffee-ai-docs/11-notification-printing-offline.md §4.
class ReceiptItem {
  ReceiptItem({required this.name, required this.qty, required this.price});

  final String name;
  final int qty;
  final int price;

  int get lineTotal => qty * price;
}

class Receipt {
  Receipt({
    required this.boothName,
    required this.saleNo,
    required this.time,
    required this.items,
    required this.total,
    required this.paymentMethod,
    this.staffName,
  });

  final String boothName;
  final String saleNo;
  final DateTime time;
  final List<ReceiptItem> items;
  final int total;
  final String paymentMethod;
  final String? staffName;

  int get subtotal => items.fold(0, (sum, item) => sum + item.lineTotal);
}
