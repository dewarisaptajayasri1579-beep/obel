/// Model struk untuk dicetak. Sengaja dibangun dari JSON yang dikirim PWA
/// lewat bridge (bukan dari state Dart lokal seperti di booth_flutter),
/// karena app ini cuma shell — semua alur transaksi ada di web.
class ReceiptItem {
  ReceiptItem({required this.name, required this.qty, required this.price});

  final String name;
  final int qty;
  final int price;

  int get lineTotal => qty * price;

  factory ReceiptItem.fromJson(Map<String, dynamic> json) {
    return ReceiptItem(
      name: json['name'] as String,
      qty: (json['qty'] as num).toInt(),
      price: (json['price'] as num).toInt(),
    );
  }
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

  factory Receipt.fromJson(Map<String, dynamic> json) {
    return Receipt(
      boothName: json['boothName'] as String,
      saleNo: json['saleNo'] as String,
      time: DateTime.parse(json['time'] as String),
      items: (json['items'] as List<dynamic>)
          .map((e) => ReceiptItem.fromJson(e as Map<String, dynamic>))
          .toList(),
      total: (json['total'] as num).toInt(),
      paymentMethod: json['paymentMethod'] as String,
      staffName: json['staffName'] as String?,
    );
  }
}
