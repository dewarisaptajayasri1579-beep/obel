import 'package:intl/intl.dart';

/// Format integer Rupiah, misal 24560000 -> "Rp24.560.000".
/// Nominal wajib integer (bukan float) sesuai aturan project.
String formatRupiah(int amount) {
  final formatter = NumberFormat.decimalPattern('id_ID');
  return 'Rp${formatter.format(amount)}';
}

/// Format qty cup, misal 10 -> "10 cup".
String formatCup(int qty) => '$qty cup';

/// Format jam lokal Asia/Jakarta, misal "08.00".
String formatClock(DateTime time) {
  final hh = time.hour.toString().padLeft(2, '0');
  final mm = time.minute.toString().padLeft(2, '0');
  return '$hh.$mm';
}

String formatDateTimeLabel(DateTime time) {
  final formatter = DateFormat('d MMM yyyy, HH.mm', 'id_ID');
  return formatter.format(time);
}
