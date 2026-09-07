import 'package:flutter/material.dart';
import 'package:print_bluetooth_thermal/print_bluetooth_thermal.dart';

import '../printing/bluetooth_receipt_printer.dart';
import '../printing/receipt_printer.dart';
import '../theme.dart';

/// Pilih printer thermal Bluetooth yang sudah terpasang (paired) di OS.
/// Pairing baru dilakukan lewat pengaturan Bluetooth device, bukan di app
/// ini (docs/11-notification-printing-offline.md §4).
class PrinterSettingsScreen extends StatefulWidget {
  const PrinterSettingsScreen({super.key});

  @override
  State<PrinterSettingsScreen> createState() => _PrinterSettingsScreenState();
}

class _PrinterSettingsScreenState extends State<PrinterSettingsScreen> {
  List<PairedPrinter> _paired = [];
  String? _selectedMac;
  bool _loading = true;
  bool _testing = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    final granted = await PrintBluetoothThermal.isPermissionBluetoothGranted;
    if (!granted && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Izin Bluetooth belum diberikan. Aktifkan di pengaturan HP.')),
      );
    }
    final paired = await BluetoothReceiptPrinter.listPaired();
    final preferred = await BluetoothReceiptPrinter.loadPreferred();
    if (!mounted) return;
    setState(() {
      _paired = paired;
      _selectedMac = preferred?.macAddress;
      _loading = false;
    });
  }

  Future<void> _select(PairedPrinter printer) async {
    await BluetoothReceiptPrinter.savePreferred(printer);
    setState(() => _selectedMac = printer.macAddress);
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('Printer "${printer.name}" disimpan sebagai default.')),
    );
  }

  Future<void> _testPrint() async {
    setState(() => _testing = true);
    final printer = BluetoothReceiptPrinter();
    final connected = await printer.connect();
    bool ok = false;
    if (connected) {
      ok = await PrintBluetoothThermal.writeString(
        printText: PrintTextSize(size: 1, text: 'Test print Obbel Coffee & Milk\n\n\n'),
      );
    }
    if (!mounted) return;
    setState(() => _testing = false);
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(ok ? 'Test print terkirim.' : 'Gagal terhubung ke printer.'),
        backgroundColor: ok ? ObbelTheme.primaryDark : ObbelTheme.accentRed,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: ObbelTheme.backgroundLight,
      appBar: AppBar(title: const Text('Pengaturan Printer')),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _load,
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  const Text(
                    'Printer Terpasang (Paired)',
                    style: TextStyle(fontWeight: FontWeight.w800, fontSize: 14, color: ObbelTheme.textDark),
                  ),
                  const SizedBox(height: 4),
                  const Text(
                    'Pasangkan printer Bluetooth lewat pengaturan HP terlebih dahulu, lalu pilih di sini.',
                    style: TextStyle(fontSize: 12, color: ObbelTheme.textLight),
                  ),
                  const SizedBox(height: 12),
                  if (_paired.isEmpty)
                    const Padding(
                      padding: EdgeInsets.symmetric(vertical: 24),
                      child: Text('Belum ada printer Bluetooth yang terpasang.', style: TextStyle(color: ObbelTheme.textLight)),
                    )
                  else
                    ..._paired.map((p) => Container(
                          margin: const EdgeInsets.only(bottom: 8),
                          decoration: BoxDecoration(
                            color: Colors.white,
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(
                              color: _selectedMac == p.macAddress ? ObbelTheme.primaryMedium : Colors.grey.shade200,
                              width: _selectedMac == p.macAddress ? 2 : 1,
                            ),
                          ),
                          child: ListTile(
                            leading: Icon(
                              Icons.print,
                              color: _selectedMac == p.macAddress ? ObbelTheme.primaryMedium : ObbelTheme.textLight,
                            ),
                            title: Text(p.name, style: const TextStyle(fontWeight: FontWeight.w700)),
                            subtitle: Text(p.macAddress, style: const TextStyle(fontSize: 11)),
                            trailing: _selectedMac == p.macAddress
                                ? const Icon(Icons.check_circle, color: ObbelTheme.primaryMedium)
                                : null,
                            onTap: () => _select(p),
                          ),
                        )),
                  const SizedBox(height: 20),
                  if (_selectedMac != null)
                    OutlinedButton.icon(
                      onPressed: _testing ? null : _testPrint,
                      icon: _testing
                          ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2))
                          : const Icon(Icons.receipt_long),
                      label: const Text('Test Print'),
                    ),
                ],
              ),
            ),
    );
  }
}
