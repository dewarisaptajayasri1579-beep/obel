import 'receipt.dart';

enum PrinterStatus { disconnected, connecting, connected, error }

/// Abstraksi printer struk — sama kontraknya dengan
/// booth_flutter/lib/printing/receipt_printer.dart (docs/11 §4), supaya
/// implementasi Bluetooth bisa diganti tanpa menyentuh kode bridge.
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

  Map<String, dynamic> toJson() => {'name': name, 'macAddress': macAddress};
}
