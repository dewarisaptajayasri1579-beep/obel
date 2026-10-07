/// Satu baris struk yang SUDAH disusun web (lihat admin_web/src/lib/receipt.ts): teks sudah
/// dibungkus dan dirata ke lebar kertas 58mm (32 karakter, atau 16 untuk [size] 2). Aplikasi ini sengaja
/// tidak punya logika tata letak — hanya menerjemahkan baris ke ESC/POS — sehingga format struk bisa
/// diubah dari web tanpa membangun ulang APK.
class PrintLine {
  const PrintLine({required this.text, this.align = PrintAlign.left, this.bold = false, this.size = 1});

  final String text;
  final PrintAlign align;
  final bool bold;

  /// 1 = normal, 2 = tinggi dan lebar ganda (judul).
  final int size;

  factory PrintLine.fromJson(Map<String, dynamic> json) {
    return PrintLine(
      text: json['text'] as String,
      align: switch (json['align']) {
        'center' => PrintAlign.center,
        'right' => PrintAlign.right,
        _ => PrintAlign.left,
      },
      bold: json['bold'] == true,
      size: (json['size'] as num?)?.toInt() == 2 ? 2 : 1,
    );
  }

  static List<PrintLine> listFromJson(Object? raw) {
    if (raw is! List) throw const FormatException('Struk tidak berisi daftar baris.');
    return raw.map((e) => PrintLine.fromJson(e as Map<String, dynamic>)).toList();
  }
}

enum PrintAlign { left, center, right }
