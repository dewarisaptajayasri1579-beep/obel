import 'package:flutter/material.dart';

import '../theme.dart';
import '../dummy_stock_history.dart'; // TODO: hapus import ini setelah selesai
// testing, lalu sambungkan ke data riwayat asli (lihat catatan TODO di bawah).

const Color _kGreen = ObbelTheme.primaryDark;

String _two(int v) => v.toString().padLeft(2, '0');

String _timeLabel(DateTime d) => '${_two(d.hour)}:${_two(d.minute)} WIB';

const _bulan = [
  'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
  'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des',
];

String _dateLabel(DateTime d) => '${d.day} ${_bulan[d.month - 1]} ${d.year}';

/// Label grup tanggal: "Hari Ini", "Kemarin", atau tanggal penuh untuk
/// entri yang lebih lama.
String _dayGroupLabel(DateTime d, DateTime now) {
  final today = DateTime(now.year, now.month, now.day);
  final day = DateTime(d.year, d.month, d.day);
  final diff = today.difference(day).inDays;
  if (diff == 0) return 'Hari Ini';
  if (diff == 1) return 'Kemarin';
  return _dateLabel(d);
}

IconData _typeIcon(HistoryType type) {
  switch (type) {
    case HistoryType.receipt:
      return Icons.move_to_inbox_outlined;
    case HistoryType.submission:
      return Icons.send_outlined;
  }
}

String _typeFilterLabel(HistoryType type) {
  switch (type) {
    case HistoryType.receipt:
      return 'Penerimaan Stok';
    case HistoryType.submission:
      return 'Pengajuan Restock';
  }
}

// =====================================================================
// SCREEN
// =====================================================================

class StockHistoryScreen extends StatefulWidget {
  const StockHistoryScreen({super.key});

  @override
  State<StockHistoryScreen> createState() => _StockHistoryScreenState();
}

class _StockHistoryScreenState extends State<StockHistoryScreen> {
  // TODO: setelah testing selesai, ganti `_allHistory` dengan data riwayat
  // asli (mis. dari AppState/ApiClient), dan sesuaikan field
  // DummyHistoryEntry -> model riwayat yang sebenarnya.
  final List<DummyHistoryEntry> _allHistory = buildDummyStockHistory();

  HistoryType? _typeFilter; // null = Semua

  List<DummyHistoryEntry> get _filtered {
    final list = _typeFilter == null
        ? _allHistory
        : _allHistory.where((e) => e.type == _typeFilter).toList();
    final sorted = [...list]..sort((a, b) => b.time.compareTo(a.time));
    return sorted;
  }

  int get _totalDiajukan => _allHistory
      .where((e) => e.type == HistoryType.submission)
      .fold(0, (total, e) => total + e.totalQty);

  int get _totalDiterima => _allHistory
      .where((e) => e.type == HistoryType.receipt)
      .fold(0, (total, e) => total + e.totalQty);

  /// Kelompokkan entri (yang sudah difilter & diurutkan) ke dalam
  /// grup per-hari, sambil menjaga urutan grup dari yang terbaru.
  List<MapEntry<String, List<DummyHistoryEntry>>> _groupByDay(
    List<DummyHistoryEntry> entries,
  ) {
    final now = DateTime.now();
    final groups = <String, List<DummyHistoryEntry>>{};
    for (final entry in entries) {
      final label = _dayGroupLabel(entry.time, now);
      groups.putIfAbsent(label, () => []).add(entry);
    }
    return groups.entries.toList();
  }

  @override
  Widget build(BuildContext context) {
    final filtered = _filtered;
    final groups = _groupByDay(filtered);

    return Scaffold(
      backgroundColor: ObbelTheme.backgroundLight,
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        iconTheme: const IconThemeData(color: _kGreen),
        leading: const BackButton(),
        title: const Text(
          'Riwayat Stok',
          style: TextStyle(
            fontFamily: 'Outfit',
            fontWeight: FontWeight.w800,
            color: _kGreen,
            fontSize: 17,
          ),
        ),
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
        children: [
          _buildSummaryRow(),
          const SizedBox(height: 16),
          _buildFilterChips(),
          const SizedBox(height: 16),
          if (filtered.isEmpty)
            _buildEmptyState()
          else
            for (final group in groups) ...[
              _buildGroupHeader(group.key, group.value.first.time),
              const SizedBox(height: 10),
              for (final entry in group.value) ...[
                _buildHistoryCard(entry),
                const SizedBox(height: 12),
              ],
            ],
        ],
      ),
    );
  }

  // ===================================================================
  // SUMMARY
  // ===================================================================

  Widget _buildSummaryRow() {
    return Row(
      children: [
        Expanded(
          child: _buildSummaryTile(
            label: 'TOTAL DIAJUKAN',
            value: '+$_totalDiajukan unit',
            valueColor: const Color(0xFF2E5AAC),
            borderColor: const Color(0xFFD8E1F0),
            iconBg: const Color(0xFFEAF0FB),
            icon: Icons.assignment_turned_in_outlined,
            iconColor: const Color(0xFF2E5AAC),
          ),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: _buildSummaryTile(
            label: 'TOTAL DITERIMA',
            value: '+$_totalDiterima unit',
            valueColor: _kGreen,
            borderColor: const Color(0xFFB7E1C1),
            iconBg: const Color(0xFFE8F5E9),
            icon: Icons.move_to_inbox_outlined,
            iconColor: _kGreen,
          ),
        ),
      ],
    );
  }

  Widget _buildSummaryTile({
    required String label,
    required String value,
    required Color valueColor,
    required Color borderColor,
    required Color iconBg,
    required IconData icon,
    required Color iconColor,
  }) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: borderColor, width: 1.2),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label,
                  style: const TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.w700,
                    color: ObbelTheme.textLight,
                    letterSpacing: 0.3,
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  value,
                  style: TextStyle(
                    fontFamily: 'Outfit',
                    fontSize: 17,
                    fontWeight: FontWeight.w900,
                    color: valueColor,
                  ),
                ),
              ],
            ),
          ),
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: iconBg,
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(icon, size: 18, color: iconColor),
          ),
        ],
      ),
    );
  }

  // ===================================================================
  // FILTER CHIPS
  // ===================================================================

  Widget _buildFilterChips() {
    return SizedBox(
      height: 36,
      child: ListView(
        scrollDirection: Axis.horizontal,
        children: [
          _buildChip(
            label: 'Semua',
            selected: _typeFilter == null,
            onTap: () => setState(() => _typeFilter = null),
          ),
          for (final type in HistoryType.values)
            _buildChip(
              label: _typeFilterLabel(type),
              selected: _typeFilter == type,
              onTap: () => setState(() => _typeFilter = type),
            ),
        ],
      ),
    );
  }

  Widget _buildChip({
    required String label,
    required bool selected,
    required VoidCallback onTap,
  }) {
    return Padding(
      padding: const EdgeInsets.only(right: 8),
      child: Material(
        color: selected ? _kGreen : Colors.white,
        shape: StadiumBorder(
          side: BorderSide(color: selected ? _kGreen : Colors.grey.shade300),
        ),
        child: InkWell(
          customBorder: const StadiumBorder(),
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            child: Text(
              label,
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w700,
                color: selected ? Colors.white : ObbelTheme.textDark,
              ),
            ),
          ),
        ),
      ),
    );
  }

  // ===================================================================
  // GROUP HEADER
  // ===================================================================

  Widget _buildGroupHeader(String label, DateTime sample) {
    final showDate = label != 'Hari Ini' && label != 'Kemarin';
    return Padding(
      padding: const EdgeInsets.only(bottom: 2),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            label,
            style: const TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w800,
              color: ObbelTheme.textDark,
            ),
          ),
          if (!showDate)
            Text(
              _dateLabel(sample),
              style: TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w600,
                color: Colors.grey.shade500,
              ),
            ),
        ],
      ),
    );
  }

  // ===================================================================
  // EMPTY STATE
  // ===================================================================

  Widget _buildEmptyState() {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 60),
      child: Column(
        children: [
          Icon(Icons.history, size: 42, color: Colors.grey.shade400),
          const SizedBox(height: 10),
          const Text(
            'Belum ada riwayat pada filter ini.',
            style: TextStyle(color: ObbelTheme.textLight),
          ),
        ],
      ),
    );
  }

  // ===================================================================
  // KARTU RIWAYAT
  // ===================================================================

  Widget _buildHistoryCard(DummyHistoryEntry entry) {
    final now = DateTime.now();
    final isToday = _dayGroupLabel(entry.time, now) == 'Hari Ini';

    final content = Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header: ikon, judul, subjudul, badge status.
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: isToday
                      ? _kGreen.withValues(alpha: 0.12)
                      : Colors.grey.shade200,
                  shape: BoxShape.circle,
                ),
                child: Icon(
                  isToday ? _typeIcon(entry.type) : Icons.check_circle_outline,
                  size: 18,
                  color: isToday ? _kGreen : Colors.grey.shade600,
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      entry.title,
                      style: const TextStyle(
                        fontFamily: 'Outfit',
                        fontWeight: FontWeight.w800,
                        fontSize: 14,
                        color: ObbelTheme.textDark,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      '#${entry.id} • ${_dayGroupLabel(entry.time, now)}, '
                      '${_timeLabel(entry.time)}',
                      style: const TextStyle(
                        fontSize: 11,
                        color: ObbelTheme.textLight,
                      ),
                    ),
                  ],
                ),
              ),
              if (entry.badgeLabel != null)
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 9,
                    vertical: 4,
                  ),
                  decoration: BoxDecoration(
                    color: entry.badgeColor.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Text(
                    entry.badgeLabel!,
                    style: TextStyle(
                      fontSize: 9,
                      fontWeight: FontWeight.w800,
                      color: entry.badgeColor,
                    ),
                  ),
                ),
            ],
          ),
          const SizedBox(height: 12),

          // Kotak info produk.
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: ObbelTheme.backgroundLight,
              borderRadius: BorderRadius.circular(10),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  entry.topInfoLabel,
                  style: const TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                    color: ObbelTheme.textDark,
                  ),
                ),
                const SizedBox(height: 4),
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(
                      child: Text(
                        entry.products.map((p) => p.label).join(', '),
                        style: TextStyle(
                          fontSize: 11,
                          color: Colors.grey.shade600,
                          height: 1.35,
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        Text(
                          '+${entry.totalQty}',
                          style: const TextStyle(
                            fontFamily: 'Outfit',
                            fontSize: 15,
                            fontWeight: FontWeight.w900,
                            color: _kGreen,
                          ),
                        ),
                        Text(
                          'unit',
                          style: TextStyle(
                            fontSize: 9,
                            color: Colors.grey.shade500,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ],
            ),
          ),

          const SizedBox(height: 10),
          Divider(height: 1, color: Colors.grey.shade100),
          const SizedBox(height: 8),
          Text(
            entry.footerLabel,
            style: TextStyle(fontSize: 10, color: Colors.grey.shade500),
          ),
        ],
    );

    return Container(
      clipBehavior: Clip.antiAlias,
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
          color: isToday
              ? _kGreen.withValues(alpha: 0.35)
              : Colors.grey.shade200,
          width: 1.2,
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.02),
            blurRadius: 8,
            offset: const Offset(0, 3),
          ),
        ],
      ),
      // Entri hari ini diberi garis aksen hijau di sisi kiri, mengikuti mockup.
      child: isToday
          ? IntrinsicHeight(
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Container(width: 4, color: _kGreen),
                  Expanded(
                    child: Padding(
                      padding: const EdgeInsets.all(14),
                      child: content,
                    ),
                  ),
                ],
              ),
            )
          : Padding(
              padding: const EdgeInsets.all(14),
              child: content,
            ),
    );
  }
}