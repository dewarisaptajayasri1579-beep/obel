import 'package:esc_pos_utils_plus/esc_pos_utils_plus.dart';
import 'package:print_bluetooth_thermal/print_bluetooth_thermal.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'receipt.dart';
import 'receipt_printer.dart';

const _prefsMacKey = 'printer_mac_address';
const _prefsNameKey = 'printer_name';

/// Implementasi ReceiptPrinter berbasis printer thermal Bluetooth (58mm,
/// vendor generik ESC/POS). Pairing dilakukan lewat pengaturan Bluetooth
/// OS terlebih dahulu — app ini hanya memilih dari daftar yang sudah
/// terpasang (docs/11-notification-printing-offline.md §4: "Implementasi
/// Bluetooth vendor/package dipisah dari business logic").
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
    if (_macAddress == null) return PrinterStatus.disconnected;
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

    bytes.addAll(generator.text(
      'OBBEL COFFEE & MILK',
      styles: const PosStyles(align: PosAlign.center, bold: true, height: PosTextSize.size2, width: PosTextSize.size2),
    ));
    bytes.addAll(generator.text(receipt.boothName, styles: const PosStyles(align: PosAlign.center)));
    bytes.addAll(generator.hr());
    bytes.addAll(generator.text('No: ${receipt.saleNo}'));
    bytes.addAll(generator.text(_formatDateTime(receipt.time)));
    if (receipt.staffName != null) {
      bytes.addAll(generator.text('Petugas: ${receipt.staffName}'));
    }
    bytes.addAll(generator.hr());

    for (final item in receipt.items) {
      bytes.addAll(generator.text(item.name, styles: const PosStyles(bold: true)));
      bytes.addAll(generator.row([
        PosColumn(text: '${item.qty} x ${item.price}', width: 6),
        PosColumn(text: 'Rp ${item.lineTotal}', width: 6, styles: const PosStyles(align: PosAlign.right)),
      ]));
    }

    bytes.addAll(generator.hr());
    bytes.addAll(generator.row([
      PosColumn(text: 'TOTAL', width: 6, styles: const PosStyles(bold: true)),
      PosColumn(
        text: 'Rp ${receipt.total}',
        width: 6,
        styles: const PosStyles(bold: true, align: PosAlign.right),
      ),
    ]));
    bytes.addAll(generator.text('Metode: ${receipt.paymentMethod}'));
    bytes.addAll(generator.feed(1));
    bytes.addAll(generator.text('Terima kasih!', styles: const PosStyles(align: PosAlign.center)));
    bytes.addAll(generator.feed(2));
    bytes.addAll(generator.cut());

    return PrintBluetoothThermal.writeBytes(bytes);
  }

  String _formatDateTime(DateTime dt) {
    final local = dt.toLocal();
    String two(int n) => n.toString().padLeft(2, '0');
    return '${two(local.day)}/${two(local.month)}/${local.year} ${two(local.hour)}:${two(local.minute)}';
  }
}
