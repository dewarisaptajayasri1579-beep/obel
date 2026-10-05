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

  /// Diskon transaksi = subtotal item − total yang dibayar. Diturunkan, bukan
  /// dikirim PWA, supaya struk tetap benar untuk PWA versi mana pun.
  int get discount => subtotal > total ? subtotal - total : 0;

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

const _bulan = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

/// Rupiah sesuai konvensi UI: `Rp24.560`, negatif `-Rp1.000`.
String formatRupiah(int nilai) {
  final angka = nilai.abs().toString();
  final buf = StringBuffer();
  for (var i = 0; i < angka.length; i++) {
    if (i > 0 && (angka.length - i) % 3 == 0) buf.write('.');
    buf.write(angka[i]);
  }
  return '${nilai < 0 ? '-' : ''}Rp$buf';
}

/// Waktu struk dalam Asia/Jakarta (UTC+7, tanpa DST) sesuai konvensi UI:
/// `23 Agu 2026, 15.40` — tidak bergantung zona waktu HP.
String formatWaktuStruk(DateTime waktu) {
  final wib = waktu.toUtc().add(const Duration(hours: 7));
  String dua(int n) => n.toString().padLeft(2, '0');
  return '${wib.day} ${_bulan[wib.month - 1]} ${wib.year}, ${dua(wib.hour)}.${dua(wib.minute)}';
}
