import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../app_state.dart';
import '../theme.dart';

const Color _kGreen = ObbelTheme.primaryDark;

enum HistoryType { receipt, submission }

enum HistoryStatus { pending, approved, rejected }

class NotificationHistoryEntry {
  final String id;
  final HistoryType type;
  final HistoryStatus status;
  final DateTime time;
  final String title;
  final String message;
  final int? requestedQty;
  final String? badgeLabel;
  final Color badgeColor;

  const NotificationHistoryEntry({
    required this.id,
    required this.type,
    required this.status,
    required this.time,
    required this.title,
    required this.message,
    this.requestedQty,
    this.badgeLabel,
    this.badgeColor = Colors.grey,
  });
}

String _two(int v) => v.toString().padLeft(2, '0');

String _timeLabel(DateTime d) => '${_two(d.hour)}:${_two(d.minute)} WIB';

const _bulan = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'Mei',
  'Jun',
  'Jul',
  'Agu',
  'Sep',
  'Okt',
  'Nov',
  'Des',
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

DateTime _notificationDate(Map<String, dynamic> notification) {
  final raw = notification['createdAt'];
  if (raw is String) {
    return DateTime.tryParse(raw)?.toLocal() ?? DateTime.now();
  }
  return DateTime.now();
}

HistoryType? _notificationType(Map<String, dynamic> notification) {
  final id = (notification['id'] ?? '').toString();
  if (id.startsWith('distribution:')) return HistoryType.receipt;
  if (id.startsWith('restock:')) return HistoryType.submission;
  return null;
}

HistoryStatus _requestStatus(Map<String, dynamic> request) {
  switch ((request['status'] ?? '').toString().toUpperCase()) {
    case 'APPROVED':
      return HistoryStatus.approved;
    case 'REJECTED':
      return HistoryStatus.rejected;
    default:
      return HistoryStatus.pending;
  }
}

String _statusLabel(HistoryStatus status) {
  switch (status) {
    case HistoryStatus.approved:
      return 'Disetujui';
    case HistoryStatus.rejected:
      return 'Ditolak';
    case HistoryStatus.pending:
      return 'Menunggu Persetujuan';
  }
}

Color _statusColor(HistoryStatus status) {
  switch (status) {
    case HistoryStatus.approved:
      return Colors.green.shade700;
    case HistoryStatus.rejected:
      return Colors.redAccent;
    case HistoryStatus.pending:
      return Colors.amber.shade800;
  }
}

Color _notificationBadgeColor(Map<String, dynamic> notification) {
  switch ((notification['type'] ?? '').toString()) {
    case 'success':
      return Colors.green.shade700;
    case 'error':
      return Colors.redAccent;
    case 'warning':
      return Colors.amber.shade800;
    default:
      return Colors.blueGrey;
  }
}

String _notificationBadgeLabel(Map<String, dynamic> notification) {
  switch ((notification['type'] ?? '').toString()) {
    case 'success':
      return 'Disetujui';
    case 'error':
      return 'Perlu Perhatian';
    case 'warning':
      return 'Kritis';
    default:
      return 'Aktif';
  }
}

NotificationHistoryEntry _mapNotification(
  Map<String, dynamic> notification,
  HistoryType type,
  List<Map<String, dynamic>> restockRequests,
) {
  int? requestedQty;
  if (type == HistoryType.submission) {
    final notificationId = (notification['id'] ?? '').toString();
    final requestId = notificationId.startsWith('restock:')
        ? notificationId.substring('restock:'.length)
        : '';
    for (final request in restockRequests) {
      if ((request['id'] ?? '').toString() == requestId) {
        final items = request['items'];
        if (items is List) {
          requestedQty = items.fold<int>(0, (total, rawItem) {
            if (rawItem is! Map) return total;
            final quantity = rawItem['qtyRequested'];
            return total + (quantity is num ? quantity.toInt() : 0);
          });
        }
        break;
      }
    }
  }

  return NotificationHistoryEntry(
    id: (notification['id'] ?? 'notification').toString(),
    type: type,
    status: HistoryStatus.approved,
    time: _notificationDate(notification),
    title: type == HistoryType.receipt
        ? 'Penerimaan Stok'
        : (notification['title'] ?? 'Pengajuan Restock').toString(),
    message: (notification['message'] ?? '').toString(),
    requestedQty: requestedQty,
    badgeLabel: _notificationBadgeLabel(notification),
    badgeColor: _notificationBadgeColor(notification),
  );
}

NotificationHistoryEntry _mapRestockRequest(Map<String, dynamic> request) {
  final status = _requestStatus(request);
  final items = request['items'];
  final requestedQty = items is List
      ? items.fold<int>(0, (total, rawItem) {
          if (rawItem is! Map) return total;
          final quantity = rawItem['qtyRequested'];
          return total + (quantity is num ? quantity.toInt() : 0);
        })
      : null;
  final requestNo = (request['requestNo'] ?? '').toString();
  final reason = (request['rejectReason'] ?? '').toString();

  return NotificationHistoryEntry(
    id: (request['id'] ?? requestNo).toString(),
    type: HistoryType.submission,
    status: status,
    time: _notificationDate({'createdAt': request['createdAt']}),
    title: status == HistoryStatus.rejected
        ? 'Pengajuan Restock Ditolak'
        : status == HistoryStatus.approved
        ? 'Restock Disetujui'
        : 'Pengajuan Restock',
    message: status == HistoryStatus.rejected && reason.isNotEmpty
        ? 'Alasan: $reason'
        : requestNo.isEmpty
        ? 'Pengajuan restock sedang diproses.'
        : 'Pengajuan $requestNo ${_statusLabel(status).toLowerCase()}.',
    requestedQty: requestedQty,
    badgeLabel: _statusLabel(status),
    badgeColor: _statusColor(status),
  );
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
  HistoryStatus? _statusFilter; // null = Semua

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) {
        final appState = context.read<AppState>();
        appState.refreshRestockRequests();
        appState.refreshNotifications();
      }
    });
  }

  List<NotificationHistoryEntry> _historyFromNotifications(
    List<Map<String, dynamic>> notifications,
    List<Map<String, dynamic>> restockRequests,
  ) {
    final entries = <NotificationHistoryEntry>[];
    for (final notification in notifications) {
      final type = _notificationType(notification);
      if (type != null) {
        entries.add(_mapNotification(notification, type, restockRequests));
      }
    }
    final notificationRestockIds = notifications
        .where(
          (notification) =>
              (notification['id'] ?? '').toString().startsWith('restock:'),
        )
        .map(
          (notification) => (notification['id'] ?? '').toString().substring(
            'restock:'.length,
          ),
        )
        .toSet();
    for (final request in restockRequests) {
      if (!notificationRestockIds.contains((request['id'] ?? '').toString())) {
        entries.add(_mapRestockRequest(request));
      }
    }
    entries.sort((a, b) => b.time.compareTo(a.time));
    return entries;
  }

  List<NotificationHistoryEntry> _filtered(
    List<NotificationHistoryEntry> allHistory,
  ) {
    final list = _statusFilter == null
        ? allHistory
        : allHistory.where((e) => e.status == _statusFilter).toList();
    final sorted = [...list]..sort((a, b) => b.time.compareTo(a.time));
    return sorted;
  }

  /// Kelompokkan entri (yang sudah difilter & diurutkan) ke dalam
  /// grup per-hari, sambil menjaga urutan grup dari yang terbaru.
  List<MapEntry<String, List<NotificationHistoryEntry>>> _groupByDay(
    List<NotificationHistoryEntry> entries,
  ) {
    final now = DateTime.now();
    final groups = <String, List<NotificationHistoryEntry>>{};
    for (final entry in entries) {
      final label = _dayGroupLabel(entry.time, now);
      groups.putIfAbsent(label, () => []).add(entry);
    }
    return groups.entries.toList();
  }

  @override
  Widget build(BuildContext context) {
    final notifications = context.watch<AppState>().notifications;
    final restockRequests = context.watch<AppState>().restockRequests;
    final allHistory = _historyFromNotifications(
      notifications,
      restockRequests,
    );
    final filtered = _filtered(allHistory);
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
          _buildSummaryRow(allHistory),
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

  Widget _buildSummaryRow(List<NotificationHistoryEntry> allHistory) {
    final totalDiajukan = allHistory
        .where((e) => e.type == HistoryType.submission)
        .length;
    final totalDiterima = allHistory
        .where((e) => e.type == HistoryType.receipt)
        .length;
    return Row(
      children: [
        Expanded(
          child: _buildSummaryTile(
            label: 'NOTIF. RESTOCK',
            value: '$totalDiajukan notif',
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
            label: 'NOTIF. STOK MASUK',
            value: '$totalDiterima notif',
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
            selected: _statusFilter == null,
            onTap: () => setState(() => _statusFilter = null),
          ),
          for (final status in [HistoryStatus.approved, HistoryStatus.rejected])
            _buildChip(
              label: _statusLabel(status),
              selected: _statusFilter == status,
              onTap: () => setState(() => _statusFilter = status),
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

  Widget _buildHistoryCard(NotificationHistoryEntry entry) {
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
                    '${_dayGroupLabel(entry.time, now)}, '
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
                padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
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

        // Detail yang ditampilkan langsung dari pesan notifikasi server.
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
              if (entry.requestedQty != null) ...[
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text(
                      'Jumlah diajukan',
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w700,
                        color: ObbelTheme.textDark,
                      ),
                    ),
                    Text(
                      '+${entry.requestedQty} unit',
                      style: const TextStyle(
                        fontFamily: 'Outfit',
                        fontSize: 15,
                        fontWeight: FontWeight.w900,
                        color: _kGreen,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 6),
              ],
              Text(
                entry.message,
                style: TextStyle(
                  fontSize: 11,
                  color: Colors.grey.shade600,
                  height: 1.35,
                ),
              ),
            ],
          ),
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
          : Padding(padding: const EdgeInsets.all(14), child: content),
    );
  }
}
