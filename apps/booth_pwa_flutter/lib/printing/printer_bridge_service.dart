import 'package:permission_handler/permission_handler.dart' hide openAppSettings;
import 'package:permission_handler/permission_handler.dart' as permission_handler show openAppSettings;

import 'bluetooth_receipt_printer.dart';
import 'receipt.dart';
import 'receipt_printer.dart';

/// Izin yang dibutuhkan buat baca daftar paired device & connect di
/// Android 12+ — BLUETOOTH_SCAN sebenarnya buat discovery device baru
/// (bukan skenario kita, cuma baca yang SUDAH di-pairing), tapi tetap
/// diminta sekalian karena beberapa OEM/versi plugin ikut mensyaratkannya
/// walau secara dokumentasi resmi Android harusnya cukup CONNECT saja.
const _izinBluetooth = [Permission.bluetoothConnect, Permission.bluetoothScan];

/// Lapisan tipis yang menerjemahkan payload JSON dari PWA ke pemanggilan
/// [BluetoothReceiptPrinter] — satu-satunya alasan lapisan ini ada adalah
/// supaya WebBridge tidak perlu tahu detail model Receipt/PairedPrinter.
class PrinterBridgeService {
  final _printer = BluetoothReceiptPrinter();

  /// Android 12+ (API 31+) butuh izin BLUETOOTH_CONNECT diminta di RUNTIME
  /// sebelum baca daftar device paired atau connect — beda dari lokasi/kamera
  /// yang izinnya sudah diminta di webview_screen.dart, izin Bluetooth ini
  /// belum pernah diminta sama sekali di mana pun sebelumnya, jadi
  /// pairedBluetooths() diam-diam selalu kosong di Android 12+ walau
  /// printernya sudah di-pairing lewat pengaturan OS. No-op otomatis granted
  /// di Android <12 (permission_handler yang urus, BLUETOOTH biasa di sana
  /// cukup lewat manifest tanpa dialog runtime).
  Future<bool> _ensureBluetoothPermission() async {
    final statuses = await _izinBluetooth.request();
    return statuses.values.every((s) => s.isGranted);
  }

  /// true kalau izin Bluetooth pernah ditolak permanen ("jangan tanya
  /// lagi") — pada kondisi ini `.request()` TIDAK akan menampilkan dialog
  /// apapun lagi (langsung balik denied diam-diam), satu-satunya jalan
  /// pemulihan adalah buka Settings app manual. Ini pola yang SAMA persis
  /// dengan LocationBridgeService.isPermanentlyDenied — kalau dulu nggak
  /// ada penanganan ini, list printer kelihatan "kosong selamanya" tanpa
  /// penjelasan begitu user kebetulan menolak dialog sekali.
  Future<bool> get isPermissionPermanentlyDenied async {
    final statuses = await Future.wait(_izinBluetooth.map((p) => p.status));
    return statuses.any((s) => s.isPermanentlyDenied);
  }

  Future<bool> openAppSettings() => permission_handler.openAppSettings();

  Future<List<Map<String, dynamic>>> listPaired() async {
    if (!await _ensureBluetoothPermission()) return [];
    final printers = await BluetoothReceiptPrinter.listPaired();
    return printers.map((p) => p.toJson()).toList();
  }

  Future<void> select(String name, String macAddress) async {
    await BluetoothReceiptPrinter.savePreferred(PairedPrinter(name: name, macAddress: macAddress));
  }

  Future<String> status() async {
    if (!await _ensureBluetoothPermission()) return PrinterStatus.disconnected.name;
    final status = await _printer.getStatus();
    return status.name;
  }

  Future<bool> print(Map<String, dynamic> receiptJson) async {
    if (!await _ensureBluetoothPermission()) return false;
    final receipt = Receipt.fromJson(receiptJson);
    return _printer.printReceipt(receipt);
  }
}
