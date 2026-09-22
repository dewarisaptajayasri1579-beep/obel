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
      if (item.discrepancy != 0 && item.reasonCode == null) {
        return false;
      }
    }

    return true;
  }

  Future<void> _confirm() async {
    final items = _items;

    if (items == null) return;

    final discrepant =
        items.where((i) => i.discrepancy != 0).toList();

    final proceed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text(
          'Konfirmasi Closing',
          style: TextStyle(
            fontWeight: FontWeight.w800,
          ),
        ),
        content: SizedBox(
          width: double.maxFinite,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (discrepant.isEmpty)
                const Text(
                  'Semua stok sesuai expected. Tidak ada selisih.',
                )
              else ...[
                const Text(
                  'Selisih ditemukan:',
                  style: TextStyle(
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 8),
                for (final item in discrepant)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 5),
                    child: Text(
                      '${item.productName}: ${item.expectedQty} → ${item.actualQty} (${item.reasonCode})',
                    ),
                  ),
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

    if (!mounted) return;

    setState(() => _confirming = true);

    final appState = context.read<AppState>();

    try {
      await appState.confirmShiftClosing(items);

      if (!mounted) return;

      appState.logout();

      Navigator.of(context).pushNamedAndRemoveUntil(
        '/login',
        (route) => false,
      );

      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text(
            'Shift berhasil ditutup. Sampai jumpa!',
          ),
        ),
      );
    } on ApiException catch (e) {
      if (!mounted) return;

      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(e.message),
          backgroundColor: ObbelTheme.accentRed,
        ),
      );
    } finally {
      if (mounted) {
        setState(() => _confirming = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final appState = context.watch<AppState>();

    return Scaffold(
      backgroundColor: ObbelTheme.backgroundLight,
      body: _buildBody(appState),
    );
  }

  Widget _buildBody(AppState appState) {
    if (_error != null) {
      return SafeArea(
        child: Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  width: 56,
                  height: 56,
                  decoration: BoxDecoration(
                    color: Colors.red.shade50,
                    shape: BoxShape.circle,
                  ),
                  child: Icon(
                    Icons.error_outline,
                    color: ObbelTheme.accentRed,
                    size: 30,
                  ),
                ),
                const SizedBox(height: 14),
                const Text(
                  'Gagal Memuat Closing',
                  style: TextStyle(
                    fontSize: 17,
                    fontWeight: FontWeight.w800,
                    color: ObbelTheme.textDark,
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  _error!,
                  textAlign: TextAlign.center,
                  style: const TextStyle(
                    color: ObbelTheme.textLight,
                  ),
                ),
              ],
            ),
          ),
        ),
      );
    }

    final items = _items;

    if (items == null) {
      return const Center(
        child: CircularProgressIndicator(),
      );
    }

    return SafeArea(
      child: Column(
        children: [
          Expanded(
            child: ListView(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 18),
              children: [
                _buildPageTitle(),
                const SizedBox(height: 14),
                for (final item in items) ...[
                  _buildProductCard(item),
                  const SizedBox(height: 12),
                ],
                _buildReturnSummary(items),
                const SizedBox(height: 18),
              ],
            ),
          ),
          _buildBottomActions(),
        ],
      ),
    );
  }

  Widget _buildPageTitle() {
    return Row(
      children: [
        IconButton(
          onPressed: () {
            Navigator.of(context).pop();
          },
          icon: const Icon(
            Icons.arrow_back,
            color: ObbelTheme.textDark,
            size: 24,
          ),
          padding: EdgeInsets.zero,
          constraints: const BoxConstraints(
            minWidth: 40,
            minHeight: 40,
          ),
        ),
        const SizedBox(width: 8),
        const Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Closing Shift',
                style: TextStyle(
                  color: ObbelTheme.textDark,
                  fontSize: 20,
                  fontWeight: FontWeight.w800,
                ),
              ),
              SizedBox(height: 3),
              Text(
                'Hitung sisa cup fisik sebelum tutup shift',
                style: TextStyle(
                  color: ObbelTheme.textLight,
                  fontSize: 12.5,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildProductCard(ClosingCountItem item) {
    final hasDiscrepancy = item.discrepancy != 0;
    final isLess = item.discrepancy < 0;

    return Container(
      padding: const EdgeInsets.fromLTRB(14, 16, 14, 14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(
          color: hasDiscrepancy
              ? Colors.red.shade100
              : Colors.grey.shade200,
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.035),
            blurRadius: 10,
            offset: const Offset(0, 3),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 48,
                height: 48,
                decoration: BoxDecoration(
                  color: _productBackground(item.productName),
                  borderRadius: BorderRadius.circular(13),
                ),
                child: Icon(
                  _productIcon(item.productName),
                  color: _productColor(item.productName),
                  size: 24,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      item.productName,
                      style: const TextStyle(
                        color: Color(0xFF182033),
                        fontSize: 16,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    const SizedBox(height: 3),
                    Text(
                      'Sistem: ${item.expectedQty} cup',
                      style: const TextStyle(
                        color: ObbelTheme.textLight,
                        fontSize: 12.5,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              _buildStatusBadge(item),
            ],
          ),
          const SizedBox(height: 14),
          _buildQuantityInput(item),
          if (hasDiscrepancy) ...[
            const SizedBox(height: 12),
            _buildDiscrepancySection(item, isLess),
          ],
        ],
      ),
    );
  }

  Widget _buildStatusBadge(ClosingCountItem item) {
    if (item.discrepancy == 0) {
      return Container(
        padding: const EdgeInsets.symmetric(
          horizontal: 11,
          vertical: 7,
        ),
        decoration: BoxDecoration(
          color: const Color(0xFFD5F7E8),
          borderRadius: BorderRadius.circular(18),
        ),
        child: const Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              Icons.check,
              size: 15,
              color: Color(0xFF08764C),
            ),
            SizedBox(width: 4),
            Text(
              'Cocok',
              style: TextStyle(
                color: Color(0xFF08764C),
                fontSize: 12,
                fontWeight: FontWeight.w800,
              ),
            ),
          ],
        ),
      );
    }

    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: 10,
        vertical: 7,
      ),
      decoration: BoxDecoration(
        color: Colors.red.shade50,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(
          color: Colors.red.shade100,
        ),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            Icons.warning_rounded,
            size: 14,
            color: Colors.red.shade600,
          ),
          const SizedBox(width: 4),
          Text(
            item.discrepancy > 0
                ? 'Selisih +${item.discrepancy}'
                : 'Selisih ${item.discrepancy}',
            style: TextStyle(
              color: Colors.red.shade600,
              fontSize: 11.5,
              fontWeight: FontWeight.w800,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildQuantityInput(ClosingCountItem item) {
    return Container(
      height: 64,
      padding: const EdgeInsets.symmetric(horizontal: 9),
      decoration: BoxDecoration(
        color: const Color(0xFFF8FAFB),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
          color: const Color(0xFFE7EBEF),
        ),
      ),
      child: Row(
        children: [
          const Padding(
            padding: EdgeInsets.only(left: 10),
            child: Text(
              'Input Fisik Sisa',
              style: TextStyle(
                color: Color(0xFF70798A),
                fontSize: 13.5,
                fontWeight: FontWeight.w500,
              ),
            ),
          ),
          const Spacer(),
          _buildQuantityButton(
            icon: Icons.remove,
            onPressed: item.actualQty > 0
                ? () {
                    setState(() {
                      item.actualQty--;
                    });
                  }
                : null,
            outlined: true,
          ),
          const SizedBox(width: 12),
          SizedBox(
            width: 32,
            child: Text(
              '${item.actualQty}',
              textAlign: TextAlign.center,
              style: TextStyle(
                color: item.discrepancy < 0
                    ? Colors.red.shade600
                    : const Color(0xFF182033),
                fontSize: 20,
                fontWeight: FontWeight.w800,
              ),
            ),
          ),
          const SizedBox(width: 12),
          _buildQuantityButton(
            icon: Icons.add,
            onPressed: () {
              setState(() {
                item.actualQty++;
              });
            },
            outlined: false,
          ),
        ],
      ),
    );
  }

  Widget _buildQuantityButton({
    required IconData icon,
    required VoidCallback? onPressed,
    required bool outlined,
  }) {
    return SizedBox(
      width: 42,
      height: 42,
      child: Material(
        color: outlined
            ? Colors.white
            : ObbelTheme.primaryDark,
        shape: CircleBorder(
          side: outlined
              ? BorderSide(
                  color: Colors.grey.shade300,
                )
              : BorderSide.none,
        ),
        child: InkWell(
          customBorder: const CircleBorder(),
          onTap: onPressed,
          child: Icon(
            icon,
            color: outlined
                ? const Color(0xFF5D6675)
                : Colors.white,
            size: 21,
          ),
        ),
      ),
    );
  }

  Widget _buildDiscrepancySection(
    ClosingCountItem item,
    bool isLess,
  ) {
    return Container(
      padding: const EdgeInsets.only(top: 12),
      decoration: BoxDecoration(
        border: Border(
          top: BorderSide(
            color: Colors.red.shade100,
          ),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(
                Icons.warning_rounded,
                size: 16,
                color: Colors.red.shade600,
              ),
              const SizedBox(width: 6),
              Text(
                'WAJIB PILIH ALASAN SELISIH',
                style: TextStyle(
                  color: Colors.red.shade600,
                  fontSize: 12,
                  fontWeight: FontWeight.w800,
                ),
              ),
              const Spacer(),
              Text(
                isLess
                    ? '${item.discrepancy.abs()} cup hilang'
                    : '+${item.discrepancy} cup',
                style: TextStyle(
                  color: Colors.red.shade400,
                  fontSize: 11.5,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Wrap(
            spacing: 7,
            runSpacing: 7,
            children: [
              for (final reason in _reasonOptions)
                _buildReasonButton(
                  item,
                  reason,
                ),
            ],
          ),
          if (item.reasonCode != null) ...[
            const SizedBox(height: 9),
            Row(
              children: [
                Icon(
                  Icons.edit_note,
                  size: 16,
                  color: ObbelTheme.primaryDark,
                ),
                const SizedBox(width: 5),
                Expanded(
                  child: Text(
                    'Alasan: ${item.reasonCode}',
                    style: const TextStyle(
                      color: ObbelTheme.primaryDark,
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildReasonButton(
    ClosingCountItem item,
    String reason,
  ) {
    final selected = item.reasonCode == reason;

    IconData icon;

    switch (reason) {
      case 'Tumpah':
        icon = Icons.water_drop;
        break;
      case 'Rusak':
        icon = Icons.heart_broken;
        break;
      case 'Hilang':
        icon = Icons.search;
        break;
      default:
        icon = Icons.more_horiz;
    }

    return InkWell(
      borderRadius: BorderRadius.circular(11),
      onTap: () {
        setState(() {
          item.reasonCode = reason;
        });
      },
      child: Container(
        padding: const EdgeInsets.symmetric(
          horizontal: 12,
          vertical: 10,
        ),
        decoration: BoxDecoration(
          color: selected
              ? Colors.red.shade50
              : const Color(0xFFF8FAFB),
          borderRadius: BorderRadius.circular(11),
          border: Border.all(
            color: selected
                ? Colors.red.shade400
                : const Color(0xFFE0E5EA),
            width: selected ? 1.2 : 1,
          ),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              icon,
              size: 15,
              color: selected
                  ? Colors.red.shade600
                  : const Color(0xFF596273),
            ),
            const SizedBox(width: 6),
            Text(
              reason,
              style: TextStyle(
                color: selected
                    ? Colors.red.shade600
                    : const Color(0xFF596273),
                fontSize: 12,
                fontWeight: selected
                    ? FontWeight.w800
                    : FontWeight.w600,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildReturnSummary(List<ClosingCountItem> items) {
    final total = items.fold<int>(
      0,
      (sum, item) => sum + item.actualQty,
    );

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFFEAF5F1),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(
          color: const Color(0xFFD6EBE3),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Icon(
                Icons.assignment_return_outlined,
                color: ObbelTheme.primaryDark,
                size: 24,
              ),
              const SizedBox(width: 9),
              const Expanded(
                child: Text(
                  'Ringkasan Return Gudang Pusat',
                  style: TextStyle(
                    color: ObbelTheme.primaryDark,
                    fontSize: 15,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 11,
                  vertical: 7,
                ),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(
                    color: const Color(0xFFB8EBD3),
                  ),
                ),
                child: const Text(
                  'SOP',
                  style: TextStyle(
                    color: ObbelTheme.primaryDark,
                    fontSize: 11,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          const Text(
            'Seluruh sisa fisik cup yang dihitung wajib dikembalikan ke Gudang '
            'Pusat lewat menu "Kembalikan Stok" di tab Shift SEBELUM menekan '
            'Konfirmasi Closing — setelah closing dikonfirmasi, sesi ini akan '
            'langsung keluar (logout).',
            style: TextStyle(
              color: ObbelTheme.textLight,
              fontSize: 12.5,
              height: 1.45,
            ),
          ),
          const SizedBox(height: 14),
          Row(
            children: [
              for (var i = 0; i < items.length; i++) ...[
                if (i > 0) const SizedBox(width: 7),
                Expanded(
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 7,
                      vertical: 12,
                    ),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Column(
                      children: [
                        Text(
                          items[i].productName,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          textAlign: TextAlign.center,
                          style: const TextStyle(
                            color: ObbelTheme.textLight,
                            fontSize: 10.5,
                          ),
                        ),
                        const SizedBox(height: 3),
                        Text(
                          '${items[i].actualQty} cup',
                          style: const TextStyle(
                            color: ObbelTheme.textDark,
                            fontSize: 15,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ],
          ),
          const SizedBox(height: 14),
          Container(
            height: 1,
            color: const Color(0xFFCBE9DC),
          ),
          const SizedBox(height: 13),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text(
                'Total Cup Fisik Pulang:',
                style: TextStyle(
                  color: ObbelTheme.textLight,
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                ),
              ),
              Text(
                '$total Cup',
                style: const TextStyle(
                  color: ObbelTheme.primaryDark,
                  fontSize: 20,
                  fontWeight: FontWeight.w900,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildBottomActions() {
    return Container(
      padding: const EdgeInsets.fromLTRB(16, 10, 16, 14),
      decoration: const BoxDecoration(
        color: Colors.white,
        border: Border(
          top: BorderSide(
            color: Color(0xFFE5E7EB),
          ),
        ),
      ),
      child: SafeArea(
        top: false,
        child: Column(
          children: [
            SizedBox(
              width: double.infinity,
              height: 52,
              child: ElevatedButton.icon(
                onPressed: (_canConfirm && !_confirming)
                    ? _confirm
                    : null,
                icon: _confirming
                    ? const SizedBox(
                        width: 19,
                        height: 19,
                        child: CircularProgressIndicator(
                          color: Colors.white,
                          strokeWidth: 2.3,
                        ),
                      )
                    : const Icon(
                        Icons.lock_outline,
                        size: 20,
                      ),
                label: Text(
                  _confirming
                      ? 'Memproses...'
                      : 'KONFIRMASI CLOSING & TUTUP SHIFT',
                ),
                style: ElevatedButton.styleFrom(
                  backgroundColor: ObbelTheme.primaryDark,
                  foregroundColor: Colors.white,
                  disabledBackgroundColor: Colors.grey.shade300,
                  disabledForegroundColor: Colors.grey.shade600,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(11),
                  ),
                  textStyle: const TextStyle(
                    fontSize: 13.5,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  IconData _productIcon(String name) {
    final value = name.toLowerCase();

    if (value.contains('kopi') || value.contains('susu')) {
      return Icons.local_cafe_outlined;
    }

    if (value.contains('butter') || value.contains('scotch')) {
      return Icons.icecream_outlined;
    }

    if (value.contains('kop') || value.contains('pandan')) {
      return Icons.local_drink_outlined;
    }

    return Icons.local_cafe_outlined;
  }

  Color _productColor(String name) {
    final value = name.toLowerCase();

    if (value.contains('kopi') || value.contains('susu')) {
      return const Color(0xFF3974D8);
    }

    if (value.contains('butter') || value.contains('scotch')) {
      return const Color(0xFFC47A00);
    }

    if (value.contains('kop') || value.contains('pandan')) {
      return const Color(0xFFE03B5A);
    }

    return ObbelTheme.primaryDark;
  }

  Color _productBackground(String name) {
    final value = name.toLowerCase();

    if (value.contains('kopi') || value.contains('susu')) {
      return const Color(0xFFEFF5FF);
    }

    if (value.contains('butter') || value.contains('scotch')) {
      return const Color(0xFFFFF9E8);
    }

    if (value.contains('kop') || value.contains('pandan')) {
      return const Color(0xFFFFEFF2);
    }

    return const Color(0xFFEAF5F1);
  }
}