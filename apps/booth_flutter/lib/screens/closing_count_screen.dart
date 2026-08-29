import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../api_client.dart';
import '../app_state.dart';
import '../models.dart';
import '../theme.dart';

const _reasonOptions = ['Tumpah', 'Rusak', 'Hilang', 'Lainnya'];

class ClosingCountScreen extends StatefulWidget {
  const ClosingCountScreen({super.key});

  @override
  State<ClosingCountScreen> createState() => _ClosingCountScreenState();
}

class _ClosingCountScreenState extends State<ClosingCountScreen> {
  List<ClosingCountItem>? _items;
  String? _error;
  bool _confirming = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final items = await context.read<AppState>().startShiftClosing();
      if (!mounted) return;
      setState(() => _items = items);
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _error = e.message);
    }
  }

  bool get _canConfirm {
    final items = _items;
    if (items == null) return false;
    for (final item in items) {
      if (item.discrepancy != 0 && item.reasonCode == null) return false;
    }
    return true;
  }

  Future<void> _confirm() async {
    final items = _items;
    if (items == null) return;

    final discrepant = items.where((i) => i.discrepancy != 0).toList();
    final proceed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Konfirmasi Closing'),
        content: SizedBox(
          width: double.maxFinite,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (discrepant.isEmpty)
                const Text('Semua stok sesuai expected. Tidak ada selisih.')
              else ...[
                const Text('Selisih ditemukan:'),
                const SizedBox(height: 8),
                for (final item in discrepant)
                  Text('${item.productName}: ${item.expectedQty} → ${item.actualQty} (${item.reasonCode})'),
              ],
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('Periksa Lagi'),
          ),
          ElevatedButton(
            onPressed: () => Navigator.of(context).pop(true),
            child: const Text('Konfirmasi Closing'),
          ),
        ],
      ),
    );
    if (proceed != true) return;

    setState(() => _confirming = true);
    final appState = context.read<AppState>();
    try {
      await appState.confirmShiftClosing(items);
      if (!mounted) return;
      appState.logout();
      Navigator.of(context).pushNamedAndRemoveUntil('/login', (route) => false);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Shift berhasil ditutup. Sampai jumpa!')),
      );
    } on ApiException catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(e.message), backgroundColor: ObbelTheme.accentRed),
      );
    } finally {
      if (mounted) setState(() => _confirming = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: ObbelTheme.backgroundLight,
      appBar: AppBar(title: const Text('Hitung Stok Fisik')),
      body: _buildBody(),
    );
  }

  Widget _buildBody() {
    if (_error != null) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Text(_error!, textAlign: TextAlign.center),
        ),
      );
    }
    final items = _items;
    if (items == null) {
      return const Center(child: CircularProgressIndicator());
    }

    return Column(
      children: [
        Expanded(
          child: ListView.builder(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
            itemCount: items.length,
            itemBuilder: (context, index) {
              final item = items[index];
              return Container(
                margin: const EdgeInsets.only(bottom: 12),
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: Colors.grey.shade200),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(item.productName,
                                  style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15)),
                              Text(
                                'Expected ${item.expectedQty} cup',
                                style: const TextStyle(color: ObbelTheme.textLight, fontSize: 12.5),
                              ),
                            ],
                          ),
                        ),
                        IconButton(
                          onPressed: item.actualQty > 0
                              ? () => setState(() => item.actualQty--)
                              : null,
                          icon: const Icon(Icons.remove_circle_outline),
                          color: ObbelTheme.primaryMedium,
                        ),
                        Text('${item.actualQty}',
                            style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                        IconButton(
                          onPressed: () => setState(() => item.actualQty++),
                          icon: const Icon(Icons.add_circle_outline),
                          color: ObbelTheme.primaryMedium,
                        ),
                      ],
                    ),
                    if (item.discrepancy != 0) ...[
                      const SizedBox(height: 8),
                      Text(
                        item.discrepancy > 0
                            ? 'Selisih +${item.discrepancy} cup'
                            : 'Selisih ${item.discrepancy} cup',
                        style: TextStyle(
                          fontWeight: FontWeight.w600,
                          color: item.discrepancy > 0 ? Colors.blue.shade700 : ObbelTheme.accentRed,
                        ),
                      ),
                      const SizedBox(height: 8),
                      Wrap(
                        spacing: 8,
                        children: [
                          for (final reason in _reasonOptions)
                            ChoiceChip(
                              label: Text(reason),
                              selected: item.reasonCode == reason,
                              onSelected: (_) => setState(() => item.reasonCode = reason),
                              selectedColor: ObbelTheme.primaryDark,
                              labelStyle: TextStyle(
                                color: item.reasonCode == reason ? Colors.white : ObbelTheme.textDark,
                                fontWeight: FontWeight.w600,
                                fontSize: 12.5,
                              ),
                            ),
                        ],
                      ),
                    ],
                  ],
                ),
              );
            },
          ),
        ),
        Container(
          padding: const EdgeInsets.fromLTRB(16, 14, 16, 20),
          decoration: const BoxDecoration(
            color: Colors.white,
            border: Border(top: BorderSide(color: Color(0xFFE5E7EB))),
          ),
          child: SafeArea(
            top: false,
            child: ElevatedButton(
              onPressed: (_canConfirm && !_confirming) ? _confirm : null,
              child: _confirming
                  ? const SizedBox(
                      width: 22,
                      height: 22,
                      child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2.5),
                    )
                  : const Text('Konfirmasi Closing'),
            ),
          ),
        ),
      ],
    );
  }
}
