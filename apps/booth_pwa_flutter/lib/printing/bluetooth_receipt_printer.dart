import 'package:esc_pos_utils_plus/esc_pos_utils_plus.dart';
import 'package:print_bluetooth_thermal/print_bluetooth_thermal.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'receipt.dart';
import 'receipt_printer.dart';

const _prefsMacKey = 'printer_mac_address';
const _prefsNameKey = 'printer_name';

/// Berasal dari pola booth_flutter/lib/printing/bluetooth_receipt_printer.dart
/// (printer thermal Bluetooth 58mm generik ESC/POS, pairing lewat pengaturan
/// Bluetooth OS). Isi struk mengikuti konvensi UI (Rupiah `Rp24.000`, waktu
/// Asia/Jakarta) plus baris Subtotal & Diskon kalau transaksi berdiskon.
class BluetoothReceiptPrinter implements ReceiptPrinter {
  String? _macAddress;

  static Future<List<PairedPrinter>> listPaired() async {
    final devices = await PrintBluetoothThermal.pairedBluetooths;
    return devices.map((d) => PairedPrinter(name: d.name, macAddress: d.macAdress)).toList();
  }

  static Future<void> savePreferred(PairedPrinter printer) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_prefsMacKey, printer.macAddress);
    await prefs.setString(_prefsNameKey, printer.name);
  }

  static Future<PairedPrinter?> loadPreferred() async {
    final prefs = await SharedPreferences.getInstance();
    final mac = prefs.getString(_prefsMacKey);
    final name = prefs.getString(_prefsNameKey);
    if (mac == null) return null;
    return PairedPrinter(name: name ?? mac, macAddress: mac);
  }

  @override
  Future<bool> connect() async {
    final preferred = await loadPreferred();
    if (preferred == null) return false;
    _macAddress = preferred.macAddress;
    return PrintBluetoothThermal.connect(macPrinterAddress: preferred.macAddress);
  }

  @override
  Future<void> disconnect() async {
    await PrintBluetoothThermal.disconnect;
  }

  @override
  Future<PrinterStatus> getStatus() async {
    if (_macAddress == null) {
      final preferred = await loadPreferred();
      if (preferred == null) return PrinterStatus.disconnected;
      _macAddress = preferred.macAddress;
    }
    final connected = await PrintBluetoothThermal.connectionStatus;
    return connected ? PrinterStatus.connected : PrinterStatus.disconnected;
  }

  @override
  Future<bool> printReceipt(Receipt receipt) async {
    final connected = await PrintBluetoothThermal.connectionStatus;
    if (!connected) {
      final reconnected = await connect();
      if (!reconnected) return false;
    }

    final profile = await CapabilityProfile.load();
    final generator = Generator(PaperSize.mm58, profile);
    final bytes = <int>[];

    // Kertas 58mm muat 32 karakter; lebar ganda (size2) tinggal 16, sedangkan
    // "OBBEL COFFEE & MILK" 19 karakter dan terpotong di tengah kata. Dua baris:
    // merek di atas, deskripsinya (13 karakter, muat) di bawah.
    for (final baris in const ['OBBEL', 'COFFEE & MILK']) {
      bytes.addAll(generator.text(
        baris,
        styles: const PosStyles(align: PosAlign.center, bold: true, height: PosTextSize.size2, width: PosTextSize.size2),
      ));
    }
    bytes.addAll(generator.text(receipt.boothName, styles: const PosStyles(align: PosAlign.center)));
    bytes.addAll(generator.hr());
    bytes.addAll(generator.text('No: ${receipt.saleNo}'));
    bytes.addAll(generator.text(formatWaktuStruk(receipt.time)));
    if (receipt.staffName != null) {
      bytes.addAll(generator.text('Barista: ${receipt.staffName}'));
    }
    bytes.addAll(generator.hr());

    for (final item in receipt.items) {
      bytes.addAll(generator.text(item.name, styles: const PosStyles(bold: true)));
      bytes.addAll(generator.row([
        PosColumn(text: '${item.qty} x ${formatRupiah(item.price)}', width: 7),
        PosColumn(text: formatRupiah(item.lineTotal), width: 5, styles: const PosStyles(align: PosAlign.right)),
      ]));
    }

    bytes.addAll(generator.hr());
    if (receipt.discount > 0) {
      bytes.addAll(_baris(generator, 'Subtotal', formatRupiah(receipt.subtotal)));
      bytes.addAll(_baris(generator, 'Diskon', formatRupiah(-receipt.discount)));
    }
    bytes.addAll(_baris(generator, 'TOTAL', formatRupiah(receipt.total), tebal: true));
    bytes.addAll(generator.text('Metode: ${receipt.paymentMethod}'));
    bytes.addAll(generator.feed(1));
    bytes.addAll(generator.text('Terima kasih!', styles: const PosStyles(align: PosAlign.center)));
    bytes.addAll(generator.feed(2));
    bytes.addAll(generator.cut());

    return PrintBluetoothThermal.writeBytes(bytes);
  }

  List<int> _baris(Generator generator, String label, String nilai, {bool tebal = false}) {
    return generator.row([
      PosColumn(text: label, width: 6, styles: PosStyles(bold: tebal)),
      PosColumn(text: nilai, width: 6, styles: PosStyles(bold: tebal, align: PosAlign.right)),
    ]);
  }
}
