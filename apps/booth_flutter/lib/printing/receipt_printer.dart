import 'receipt.dart';

enum PrinterStatus { disconnected, connecting, connected, error }

/// Abstraksi printer struk (docs/11-notification-printing-offline.md §4).
/// Business logic (checkout_screen.dart) tidak boleh bergantung pada vendor
/// Bluetooth tertentu — hanya lewat interface ini, supaya implementasi
/// bisa diganti (mis. printer WiFi/USB) tanpa menyentuh alur pembayaran.
abstract class ReceiptPrinter {
  Future<bool> connect();
  Future<void> disconnect();
  Future<bool> printReceipt(Receipt receipt);
  Future<PrinterStatus> getStatus();
}

class PairedPrinter {
  PairedPrinter({required this.name, required this.macAddress});

  final String name;
  final String macAddress;
}
