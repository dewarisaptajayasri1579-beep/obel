import 'package:esc_pos_utils_plus/esc_pos_utils_plus.dart';
import 'package:print_bluetooth_thermal/print_bluetooth_thermal.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'print_line.dart';
import 'receipt_printer.dart';

const _prefsMacKey = 'printer_mac_address';
const _prefsNameKey = 'printer_name';

/// Berasal dari pola booth_flutter/lib/printing/bluetooth_receipt_printer.dart
/// (printer thermal Bluetooth 58mm generik ESC/POS, pairing lewat pengaturan
/// Bluetooth OS). Isi struk disusun web (lihat print_line.dart), bukan di sini.
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
  Future<bool> printLines(List<PrintLine> lines) async {
    final connected = await PrintBluetoothThermal.connectionStatus;
    if (!connected) {
      final reconnected = await connect();
      if (!reconnected) return false;
    }

    final profile = await CapabilityProfile.load();
    final generator = Generator(PaperSize.mm58, profile);
    final bytes = <int>[];

    // Tata letak (bungkus kata, rata kiri-kanan, lebar 32 karakter) sudah dikerjakan web; di sini
    // cuma gaya per baris yang diterjemahkan ke ESC/POS.
    for (final line in lines) {
      final ukuran = line.size == 2 ? PosTextSize.size2 : PosTextSize.size1;
      bytes.addAll(generator.text(
        line.text,
        styles: PosStyles(align: _rata(line.align), bold: line.bold, height: ukuran, width: ukuran),
      ));
    }
    bytes.addAll(generator.feed(2));
    bytes.addAll(generator.cut());

    return PrintBluetoothThermal.writeBytes(bytes);
  }

  PosAlign _rata(PrintAlign align) => switch (align) {
        PrintAlign.center => PosAlign.center,
        PrintAlign.right => PosAlign.right,
        PrintAlign.left => PosAlign.left,
      };
}
