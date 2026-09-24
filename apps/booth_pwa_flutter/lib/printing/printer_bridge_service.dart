import 'bluetooth_receipt_printer.dart';
import 'receipt.dart';
import 'receipt_printer.dart';

/// Lapisan tipis yang menerjemahkan payload JSON dari PWA ke pemanggilan
/// [BluetoothReceiptPrinter] — satu-satunya alasan lapisan ini ada adalah
/// supaya WebBridge tidak perlu tahu detail model Receipt/PairedPrinter.
class PrinterBridgeService {
  final _printer = BluetoothReceiptPrinter();

  Future<List<Map<String, dynamic>>> listPaired() async {
    final printers = await BluetoothReceiptPrinter.listPaired();
    return printers.map((p) => p.toJson()).toList();
  }

  Future<void> select(String name, String macAddress) async {
    await BluetoothReceiptPrinter.savePreferred(PairedPrinter(name: name, macAddress: macAddress));
  }

  Future<String> status() async {
    final status = await _printer.getStatus();
    return status.name;
  }

  Future<bool> print(Map<String, dynamic> receiptJson) async {
    final receipt = Receipt.fromJson(receiptJson);
    return _printer.printReceipt(receipt);
  }
}
