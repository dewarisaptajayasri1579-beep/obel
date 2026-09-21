import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../app_state.dart';
import '../obbel_icons.dart';
import '../theme.dart';
import 'stock_screen.dart';

// ===================== Helper tampilan notifikasi =====================
// Hanya untuk keperluan tampilan (UI). Tidak mengubah data / logika AppState.

enum _NotifCategory {
  inbound,
  habis,
  kritis,
  menipis,
  ditolak,
  done,
  info,
}

const Color _notifGreen = Color(0xFF0E6F3F);

_NotifCategory _notifCategoryOf(Map<String, dynamic> n) {
  final type = (n['type'] ?? '').toString().toLowerCase();

  switch (type) {
    case 'inbound':
    case 'stock_in':
    case 'restock':
      return _NotifCategory.inbound;

    case 'error':
    case 'habis':
    case 'out_of_stock':
      return _NotifCategory.habis;

    case 'warning':
    case 'kritis':
    case 'critical':
      return _NotifCategory.kritis;

    case 'low':
    case 'menipis':
    case 'low_stock':
      return _NotifCategory.menipis;

    case 'rejected':
    case 'ditolak':
    case 'declined':
    case 'restock_rejected':
      return _NotifCategory.ditolak;

    case 'success':
    case 'done':
    case 'completed':
      return _NotifCategory.done;

    default:
      return _NotifCategory.info;
  }
}

String _notifCategoryLabel(_NotifCategory c) {
  switch (c) {
    case _NotifCategory.inbound:
      return 'Penerimaan Stok';

    case _NotifCategory.habis:
      return 'Habis';

    case _NotifCategory.kritis:
      return 'Kritis';

    case _NotifCategory.menipis:
      return 'Menipis';

    case _NotifCategory.ditolak:
      return 'Ditolak';

    case _NotifCategory.done:
      return 'Selesai';

    case _NotifCategory.info:
      return 'Info';
  }
}

Color _notifCategoryColor(_NotifCategory c) {
  switch (c) {
    case _NotifCategory.inbound:
      return _notifGreen;

    case _NotifCategory.habis:
      return Colors.redAccent;

    case _NotifCategory.kritis:
      return ObbelTheme.accentOrange;

    case _NotifCategory.menipis:
      return Colors.amber.shade800;

    case _NotifCategory.ditolak:
      return const Color(0xFFB71C1C);

    case _NotifCategory.done:
      return Colors.grey.shade600;

    case _NotifCategory.info:
      return ObbelTheme.textDark;
  }
}

Color _notifStripeColor(_NotifCategory c) {
  if (c == _NotifCategory.menipis) {
    return Colors.amber.shade400;
  }

  return _notifCategoryColor(c);
}

IconData _notifCategoryIcon(_NotifCategory c) {
  switch (c) {
    case _NotifCategory.inbound:
      return Icons.local_shipping_outlined;

    case _NotifCategory.habis:
      return Icons.cancel;

    case _NotifCategory.kritis:
      return Icons.warning_rounded;

    case _NotifCategory.menipis:
      return Icons.error;

    case _NotifCategory.ditolak:
      return Icons.block;

    case _NotifCategory.done:
      return Icons.check_circle;

    case _NotifCategory.info:
      return Icons.info_outline;
  }
}

DateTime? _notifDateOf(Map<String, dynamic> n) {
  final raw = n['createdAt'] ??
      n['created_at'] ??
      n['timestamp'] ??
      n['date'];

  if (raw is DateTime) {
    return raw;
  }

  if (raw is int) {
    return DateTime.fromMillisecondsSinceEpoch(raw);
  }

  if (raw is String) {
    return DateTime.tryParse(raw)?.toLocal();
  }

  return null;
}

String _two(int v) {
  return v.toString().padLeft(2, '0');
}

String _notifTimeLabel(
  Map<String, dynamic> n, {
  bool withDay = false,
}) {
  final d = _notifDateOf(n);

  if (d == null) {
    return (n['time'] ?? '').toString();
  }

  final hm = '${_two(d.hour)}:${_two(d.minute)} WIB';

  if (!withDay) {
    return hm;
  }

  final now = DateTime.now();

  final today = DateTime(
    now.year,
    now.month,
    now.day,
  );

  final day = DateTime(
    d.year,
    d.month,
    d.day,
  );

  final diff = today.difference(day).inDays;

  if (diff == 1) {
    return 'Kemarin, $hm';
  }

  return '${_two(d.day)}/${_two(d.month)}, $hm';
}

bool _notifIsEarlier(Map<String, dynamic> n) {
  final d = _notifDateOf(n);

  if (d == null) {
    return false;
  }

  final now = DateTime.now();

  return d.isBefore(
    DateTime(
      now.year,
      now.month,
      now.day,
    ),
  );
}

String? _notifLatestLabel(
  List<Map<String, dynamic>> list,
) {
  if (list.isEmpty) {
    return null;
  }

  DateTime? latest;

  for (final n in list) {
    final d = _notifDateOf(n);

    if (d != null &&
        (latest == null || d.isAfter(latest))) {
      latest = d;
    }
  }

  if (latest != null) {
    return '${_two(latest.hour)}:${_two(latest.minute)}';
  }

  final t = list.first['time'];

  return t?.toString();
}

// =====================================================================
// HOME SCREEN
// =====================================================================

class HomeScreen extends StatefulWidget {
  const HomeScreen({
    super.key,
    this.onGoToStock,
  });

  /// Callback dari MainShell untuk berpindah ke tab "Stok" tanpa
  /// kehilangan BottomNavigationBar (dipakai oleh tombol "Ajukan
  /// Restock"). Jika null (mis. HomeScreen dibuka sendirian tanpa
  /// MainShell), akan fallback ke Navigator.push biasa.
  final VoidCallback? onGoToStock;

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  @override
  void initState() {
    super.initState();

    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<AppState>().refreshNotifications();
    });
  }

  // ===================================================================
  // NAVIGASI KE STOK
  // ===================================================================

  /// Dipanggil oleh tombol "Ajukan Restock". Kalau HomeScreen dibuka di
  /// dalam MainShell (kasus normal), ini akan memindahkan tab aktif ke
  /// Stok lewat widget.onGoToStock, sehingga BottomNavigationBar tetap
  /// terlihat. Kalau HomeScreen dibuka sendiri tanpa MainShell (tidak
  /// ada callback), baru fallback ke Navigator.push halaman StockScreen.
  void _openStock() {
    if (widget.onGoToStock != null) {
      widget.onGoToStock!();
    } else {
      Navigator.push(
        context,
        MaterialPageRoute(
          builder: (_) => const StockScreen(),
        ),
      );
    }
  }

  // ===================================================================
  // NOTIFICATION
  // ===================================================================

  void _showNotifications(
    AppState appState,
  ) {
    final items =
        List<Map<String, dynamic>>.from(
      appState.notifications,
    );

    _NotifCategory? selected;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor:
          ObbelTheme.backgroundLight,
      shape:
          const RoundedRectangleBorder(
        borderRadius:
            BorderRadius.vertical(
          top: Radius.circular(20),
        ),
      ),
      builder: (context) {
        return StatefulBuilder(
          builder: (
            context,
            setSheetState,
          ) {
            // =========================================================
            // HITUNG JUMLAH PER KATEGORI
            // =========================================================

            final counts =
                <_NotifCategory, int>{};

            for (final n in items) {
              final c =
                  _notifCategoryOf(n);

              counts[c] =
                  (counts[c] ?? 0) + 1;
            }

            // =========================================================
            // FILTER SESUAI CHIP
            // =========================================================

            final filtered =
                selected == null
                    ? items
                    : items
                        .where(
                          (n) =>
                              _notifCategoryOf(
                                n,
                              ) ==
                              selected,
                        )
                        .toList();

            // =========================================================
            // KELOMPOKKAN
            // =========================================================

            final pinned =
                <Map<String, dynamic>>[];

            final today =
                <Map<String, dynamic>>[];

            final earlier =
                <Map<String, dynamic>>[];

            for (final n in filtered) {
              if (_notifIsEarlier(n)) {
                earlier.add(n);
              } else if (
                  _notifCategoryOf(n) ==
                      _NotifCategory.inbound) {
                pinned.add(n);
              } else {
                today.add(n);
              }
            }

            final latest =
                _notifLatestLabel(
              [
                ...pinned,
                ...today,
              ],
            );

            return DraggableScrollableSheet(
              expand: false,
              initialChildSize: 0.85,
              minChildSize: 0.5,
              maxChildSize: 0.95,
              builder: (
                context,
                scrollController,
              ) {
                return SafeArea(
                  top: false,
                  child: Column(
                    children: [
                      // =================================================
                      // HANDLE
                      // =================================================

                      const SizedBox(
                        height: 10,
                      ),

                      Container(
                        width: 40,
                        height: 4,
                        decoration:
                            BoxDecoration(
                          color:
                              Colors.grey.shade300,
                          borderRadius:
                              BorderRadius.circular(
                            4,
                          ),
                        ),
                      ),

                      // =================================================
                      // HEADER
                      // =================================================

                      Padding(
                        padding:
                            const EdgeInsets
                                .fromLTRB(
                          16,
                          12,
                          8,
                          4,
                        ),
                        child: Row(
                          children: [
                            const Expanded(
                              child: Text(
                                'Notifikasi',
                                style:
                                    TextStyle(
                                  fontFamily:
                                      'Outfit',
                                  fontWeight:
                                      FontWeight
                                          .w800,
                                  fontSize: 18,
                                  color:
                                      ObbelTheme
                                          .textDark,
                                ),
                              ),
                            ),
                            IconButton(
                              icon:
                                  const Icon(
                                Icons.close,
                                color:
                                    ObbelTheme
                                        .textDark,
                              ),
                              onPressed: () =>
                                  Navigator.pop(
                                context,
                              ),
                            ),
                          ],
                        ),
                      ),

                      // =================================================
                      // FILTER CHIPS
                      // =================================================

                      SizedBox(
                        height: 40,
                        child: ListView(
                          scrollDirection:
                              Axis.horizontal,
                          padding:
                              const EdgeInsets
                                  .symmetric(
                            horizontal: 16,
                          ),
                          children: [
                            _buildNotifChip(
                              label: 'Semua',
                              count:
                                  items.length,
                              selected:
                                  selected ==
                                      null,
                              onTap: () =>
                                  setSheetState(
                                () =>
                                    selected =
                                        null,
                              ),
                            ),

                            for (final c
                                in _NotifCategory
                                    .values)
                              if ((counts[c] ??
                                      0) >
                                  0)
                                _buildNotifChip(
                                  label:
                                      _notifCategoryLabel(
                                    c,
                                  ),
                                  count:
                                      counts[c]!,
                                  selected:
                                      selected ==
                                          c,
                                  onTap: () =>
                                      setSheetState(
                                    () =>
                                        selected =
                                            c,
                                  ),
                                ),
                          ],
                        ),
                      ),

                      const SizedBox(
                        height: 8,
                      ),

                      // =================================================
                      // KONTEN
                      // =================================================

                      Expanded(
                        child: ListView(
                          controller:
                              scrollController,
                          padding:
                              const EdgeInsets
                                  .fromLTRB(
                            16,
                            4,
                            16,
                            24,
                          ),
                          children: [
                            _buildNotifInfoBanner(
                              items.length,
                            ),

                            const SizedBox(
                              height: 12,
                            ),

                            if (filtered.isEmpty)
                              _buildNotifEmpty()
                            else ...[
                              for (final n
                                  in pinned) ...[
                                _buildNotifHighlightCard(
                                  n,
                                ),
                                const SizedBox(
                                  height: 12,
                                ),
                              ],

                              if (today.isNotEmpty) ...[
                                const SizedBox(
                                  height: 4,
                                ),

                                _buildNotifSectionLabel(
                                  'HARI INI (${today.length} PEMBERITAHUAN)',
                                  trailing:
                                      latest !=
                                              null
                                          ? 'Terbaru $latest'
                                          : null,
                                ),

                                const SizedBox(
                                  height: 10,
                                ),

                                for (final n
                                    in today) ...[
                                  _notifCategoryOf(
                                            n,
                                          ) ==
                                          _NotifCategory
                                              .done
                                      ? _buildNotifPastCard(
                                          n,
                                        )
                                      : _buildNotifAlertCard(
                                          n,
                                        ),

                                  const SizedBox(
                                    height: 10,
                                  ),
                                ],
                              ],

                              if (earlier.isNotEmpty) ...[
                                const SizedBox(
                                  height: 8,
                                ),

                                _buildNotifSectionLabel(
                                  'SEBELUMNYA',
                                ),

                                const SizedBox(
                                  height: 10,
                                ),

                                for (final n
                                    in earlier) ...[
                                  _buildNotifPastCard(
                                    n,
                                  ),
                                  const SizedBox(
                                    height: 10,
                                  ),
                                ],
                              ],
                            ],
                          ],
                        ),
                      ),
                    ],
                  ),
                );
              },
            );
          },
        );
      },
    );
  }

  // ===================================================================
  // NOTIFICATION CHIP
  // ===================================================================

  Widget _buildNotifChip({
    required String label,
    required int count,
    required bool selected,
    required VoidCallback onTap,
  }) {
    return Padding(
      padding:
          const EdgeInsets.only(
        right: 8,
      ),
      child: Material(
        color: selected
            ? _notifGreen
            : Colors.white,
        shape: StadiumBorder(
          side: BorderSide(
            color: selected
                ? _notifGreen
                : Colors.grey.shade300,
          ),
        ),
        child: InkWell(
          customBorder:
              const StadiumBorder(),
          onTap: onTap,
          child: Padding(
            padding:
                const EdgeInsets.symmetric(
              horizontal: 14,
              vertical: 8,
            ),
            child: Row(
              mainAxisSize:
                  MainAxisSize.min,
              children: [
                if (selected) ...[
                  const Icon(
                    Icons.check,
                    size: 16,
                    color: Colors.white,
                  ),
                  const SizedBox(
                    width: 4,
                  ),
                ],
                Text(
                  '$label ($count)',
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: selected
                        ? FontWeight.w700
                        : FontWeight.w500,
                    color: selected
                        ? Colors.white
                        : ObbelTheme.textDark,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  // ===================================================================
  // NOTIFICATION INFO BANNER
  // ===================================================================

  Widget _buildNotifInfoBanner(
    int total,
  ) {
    return Container(
      padding:
          const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color:
            const Color(0xFFE8F5E9),
        borderRadius:
            BorderRadius.circular(12),
        border: Border.all(
          color:
              const Color(0xFFB7E1C1),
        ),
      ),
      child: Row(
        crossAxisAlignment:
            CrossAxisAlignment.start,
        children: [
          const Icon(
            Icons.info,
            color: _notifGreen,
            size: 18,
          ),
          const SizedBox(
            width: 8,
          ),
          Expanded(
            child: Text.rich(
              TextSpan(
                children: [
                  const TextSpan(
                    text:
                        'Pusat Notifikasi Booth: ',
                    style: TextStyle(
                      fontWeight:
                          FontWeight.w800,
                    ),
                  ),
                  TextSpan(
                    text:
                        'Menampilkan seluruh pemberitahuan operasional shift aktif ($total pembaruan).',
                  ),
                ],
              ),
              style:
                  const TextStyle(
                fontSize: 12,
                color: _notifGreen,
                fontWeight:
                    FontWeight.w600,
                height: 1.35,
              ),
            ),
          ),
        ],
      ),
    );
  }

  // ===================================================================
  // NOTIFICATION SECTION
  // ===================================================================

  Widget _buildNotifSectionLabel(
    String text, {
    String? trailing,
  }) {
    return Row(
      children: [
        Expanded(
          child: Text(
            text,
            style:
                const TextStyle(
              fontSize: 12,
              fontWeight:
                  FontWeight.w700,
              letterSpacing: 0.6,
              color:
                  ObbelTheme.textLight,
            ),
          ),
        ),
        if (trailing != null)
          Text(
            trailing,
            style:
                const TextStyle(
              fontSize: 11,
              fontWeight:
                  FontWeight.w700,
              color: _notifGreen,
            ),
          ),
      ],
    );
  }

  // ===================================================================
  // NOTIFICATION BADGE
  // ===================================================================

  Widget _buildNotifBadge(
    _NotifCategory c,
    String label,
  ) {
    final color =
        _notifCategoryColor(c);

    return Container(
      padding:
          const EdgeInsets.symmetric(
        horizontal: 8,
        vertical: 3,
      ),
      decoration:
          BoxDecoration(
        color:
            color.withValues(alpha: 0.12),
        borderRadius:
            BorderRadius.circular(6),
      ),
      child: Row(
        mainAxisSize:
            MainAxisSize.min,
        children: [
          Icon(
            _notifCategoryIcon(c),
            size: 13,
            color: color,
          ),
          const SizedBox(
            width: 4,
          ),
          Text(
            label,
            style: TextStyle(
              fontSize: 11,
              fontWeight:
                  FontWeight.w700,
              color: color,
            ),
          ),
        ],
      ),
    );
  }

  // ===================================================================
  // STRIPED CARD
  // ===================================================================

  Widget _buildNotifStripedCard({
    required Color stripe,
    required Color border,
    required Widget child,
  }) {
    return Container(
      clipBehavior:
          Clip.antiAlias,
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius:
            BorderRadius.circular(14),
        border: Border.all(
          color: border,
          width: 1.2,
        ),
        boxShadow: [
          BoxShadow(
            color:
                Colors.black.withValues(
              alpha: 0.03,
            ),
            blurRadius: 10,
            offset:
                const Offset(0, 4),
          ),
        ],
      ),
      child: IntrinsicHeight(
        child: Row(
          crossAxisAlignment:
              CrossAxisAlignment.stretch,
          children: [
            Container(
              width: 4,
              color: stripe,
            ),
            Expanded(
              child: Padding(
                padding:
                    const EdgeInsets
                        .fromLTRB(
                  14,
                  12,
                  14,
                  14,
                ),
                child: child,
              ),
            ),
          ],
        ),
      ),
    );
  }

  // ===================================================================
  // NOTIFICATION HIGHLIGHT
  // ===================================================================

  Widget _buildNotifHighlightCard(
    Map<String, dynamic> n,
  ) {
    final resi =
        n['resi'] ??
        n['reference'] ??
        n['ref'];

    final qty =
        n['qty'] ??
        n['quantity'];

    final qtyLabel = qty == null
        ? null
        : (qty is num
            ? '$qty unit cup'
            : qty.toString());

    final time =
        _notifTimeLabel(n);

    return _buildNotifStripedCard(
      stripe: _notifGreen,
      border: Colors.grey.shade200,
      child: Column(
        crossAxisAlignment:
            CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              _buildNotifBadge(
                _NotifCategory.inbound,
                (n['badge'] ??
                        'Stok Masuk')
                    .toString(),
              ),
              const Spacer(),
              if (time.isNotEmpty)
                Text(
                  time,
                  style:
                      const TextStyle(
                    fontSize: 11,
                    color:
                        ObbelTheme
                            .textLight,
                  ),
                ),
            ],
          ),

          const SizedBox(
            height: 8,
          ),

          Text(
            (n['title'] ?? '')
                .toString(),
            style:
                const TextStyle(
              fontFamily: 'Outfit',
              fontWeight:
                  FontWeight.w800,
              fontSize: 16,
              color:
                  ObbelTheme.textDark,
            ),
          ),

          const SizedBox(
            height: 4,
          ),

          Text(
            (n['message'] ?? '')
                .toString(),
            style:
                const TextStyle(
              fontSize: 13,
              color:
                  ObbelTheme.textLight,
              height: 1.35,
            ),
          ),

          if (resi != null ||
              qtyLabel != null) ...[
            const SizedBox(
              height: 10,
            ),

            Container(
              padding:
                  const EdgeInsets
                      .symmetric(
                horizontal: 12,
                vertical: 10,
              ),
              decoration:
                  BoxDecoration(
                color:
                    const Color(
                  0xFFF4F6F5,
                ),
                borderRadius:
                    BorderRadius.circular(
                  10,
                ),
              ),
              child: Row(
                children: [
                  if (resi != null) ...[
                    const Icon(
                      Icons.tag,
                      size: 16,
                      color:
                          ObbelTheme
                              .textLight,
                    ),

                    const SizedBox(
                      width: 6,
                    ),

                    Expanded(
                      child: Text(
                        'No. Resi $resi',
                        style:
                            const TextStyle(
                          fontSize: 13,
                          fontWeight:
                              FontWeight.w600,
                          color:
                              ObbelTheme
                                  .textDark,
                        ),
                        overflow:
                            TextOverflow
                                .ellipsis,
                      ),
                    ),
                  ] else
                    const Spacer(),

                  if (qtyLabel != null)
                    Text(
                      qtyLabel,
                      style:
                          const TextStyle(
                        fontSize: 13,
                        fontWeight:
                            FontWeight.w800,
                        color:
                            _notifGreen,
                      ),
                    ),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }

  // ===================================================================
  // NOTIFICATION ALERT
  // ===================================================================

  Widget _buildNotifAlertCard(
    Map<String, dynamic> n,
  ) {
    final c =
        _notifCategoryOf(n);

    final color =
        _notifStripeColor(c);

    final time =
        _notifTimeLabel(n);

    return _buildNotifStripedCard(
      stripe: color,
      border:
          color.withValues(alpha: 0.35),
      child: Column(
        crossAxisAlignment:
            CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Flexible(
                child:
                    _buildNotifBadge(
                  c,
                  (n['badge'] ??
                          _notifCategoryLabel(
                            c,
                          ))
                      .toString(),
                ),
              ),

              const SizedBox(
                width: 8,
              ),

              const Spacer(),

              if (time.isNotEmpty)
                Text(
                  time,
                  style:
                      const TextStyle(
                    fontSize: 11,
                    color:
                        ObbelTheme
                            .textLight,
                  ),
                ),
            ],
          ),

          const SizedBox(
            height: 8,
          ),

          Text(
            (n['title'] ?? '')
                .toString(),
            style:
                const TextStyle(
              fontFamily: 'Outfit',
              fontWeight:
                  FontWeight.w800,
              fontSize: 16,
              color:
                  ObbelTheme.textDark,
            ),
          ),

          const SizedBox(
            height: 4,
          ),

          Text(
            (n['message'] ?? '')
                .toString(),
            style:
                const TextStyle(
              fontSize: 13,
              color:
                  ObbelTheme.textLight,
              height: 1.35,
            ),
          ),
        ],
      ),
    );
  }

  // ===================================================================
  // NOTIFICATION PAST
  // ===================================================================

  Widget _buildNotifPastCard(
    Map<String, dynamic> n,
  ) {
    final c =
        _notifCategoryOf(n);

    final time =
        _notifTimeLabel(
      n,
      withDay: true,
    );

    return Container(
      padding:
          const EdgeInsets.all(14),
      decoration:
          BoxDecoration(
        color: Colors.white,
        borderRadius:
            BorderRadius.circular(14),
        border: Border.all(
          color:
              Colors.grey.shade200,
          width: 1.2,
        ),
      ),
      child: Row(
        crossAxisAlignment:
            CrossAxisAlignment.start,
        children: [
          Container(
            width: 32,
            height: 32,
            decoration:
                BoxDecoration(
              color:
                  Colors.grey.shade200,
              shape:
                  BoxShape.circle,
            ),
            child: Icon(
              c == _NotifCategory.done
                  ? Icons.check
                  : _notifCategoryIcon(
                      c,
                    ),
              size: 18,
              color:
                  Colors.grey.shade600,
            ),
          ),

          const SizedBox(
            width: 12,
          ),

          Expanded(
            child: Column(
              crossAxisAlignment:
                  CrossAxisAlignment.start,
              children: [
                Text(
                  (n['title'] ?? '')
                      .toString(),
                  style: TextStyle(
                    fontFamily:
                        'Outfit',
                    fontWeight:
                        FontWeight.w600,
                    fontSize: 15,
                    color:
                        Colors.grey
                            .shade800,
                  ),
                ),

                const SizedBox(
                  height: 2,
                ),

                Text(
                  (n['message'] ?? '')
                      .toString(),
                  style:
                      const TextStyle(
                    fontSize: 12,
                    color:
                        ObbelTheme
                            .textLight,
                    height: 1.35,
                  ),
                ),

                if (time.isNotEmpty) ...[
                  const SizedBox(
                    height: 4,
                  ),

                  Text(
                    time,
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight:
                          FontWeight.w600,
                      color: Colors.grey
                          .shade500,
                    ),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }

  // ===================================================================
  // NOTIFICATION EMPTY
  // ===================================================================

  Widget _buildNotifEmpty() {
    return Padding(
      padding:
          const EdgeInsets.symmetric(
        vertical: 48,
      ),
      child: Column(
        children: [
          Icon(
            Icons
                .notifications_off_outlined,
            size: 44,
            color:
                Colors.grey.shade400,
          ),

          const SizedBox(
            height: 10,
          ),

          const Text(
            'Belum ada notifikasi.',
            style: TextStyle(
              color:
                  ObbelTheme.textLight,
            ),
          ),
        ],
      ),
    );
  }

  // ===================================================================
  // BUILD
  // ===================================================================

  @override
  Widget build(
    BuildContext context,
  ) {
    final appState =
        context.watch<AppState>();

    return Scaffold(
      backgroundColor:
          ObbelTheme.backgroundLight,

      // ===============================================================
      // APP BAR
      // ===============================================================

      appBar: AppBar(
        backgroundColor:
            Colors.white,
        elevation: 0,
        toolbarHeight: 72,

        title: Row(
          children: [
            Column(
              crossAxisAlignment:
                  CrossAxisAlignment
                      .start,
              children: [
                const Text(
                  'Selamat pagi,',
                  style:
                      TextStyle(
                    fontSize: 13,
                    color:
                        ObbelTheme
                            .textLight,
                    fontWeight:
                        FontWeight.w500,
                  ),
                ),

                const SizedBox(
                  height: 2,
                ),

                Text(
                  '${appState.staffName} 👋',
                  style:
                      const TextStyle(
                    fontSize: 20,
                    fontWeight:
                        FontWeight.bold,
                    color:
                        ObbelTheme
                            .textDark,
                  ),
                ),

                const SizedBox(
                  height: 2,
                ),

                const Text(
                  'Booth 1 • Cabang Mall Citra',
                  style:
                      TextStyle(
                    fontSize: 12,
                    color:
                        ObbelTheme
                            .textLight,
                    fontWeight:
                        FontWeight.w500,
                  ),
                ),
              ],
            ),
          ],
        ),

        actions: [
          // ===========================================================
          // PRINTER
          // ===========================================================

          IconButton(
            icon: const Icon(
              Icons.print_outlined,
              color:
                  ObbelTheme.textDark,
            ),
            tooltip:
                'Pengaturan Printer',
            onPressed: () =>
                Navigator.pushNamed(
              context,
              '/printer-settings',
            ),
          ),

          // ===========================================================
          // NOTIFICATION
          // ===========================================================

          Stack(
            alignment:
                Alignment.center,
            children: [
              IconButton(
                icon: const Icon(
                  Icons
                      .notifications_outlined,
                  color:
                      ObbelTheme
                          .textDark,
                ),
                onPressed: () =>
                    _showNotifications(
                  appState,
                ),
              ),

              if (appState
                  .hasUnreadNotifications)
                Positioned(
                  top: 10,
                  right: 10,
                  child: Container(
                    width: 8,
                    height: 8,
                    decoration:
                        const BoxDecoration(
                      color:
                          ObbelTheme
                              .accentOrange,
                      shape:
                          BoxShape.circle,
                    ),
                  ),
                ),
            ],
          ),
        ],
      ),

      // ===============================================================
      // BODY
      // ===============================================================

      body: SingleChildScrollView(
        child: Padding(
          padding:
              const EdgeInsets.all(16.0),

          child: Column(
            crossAxisAlignment:
                CrossAxisAlignment
                    .start,

            children: [
              // =========================================================
              // 1. ACTIVE SHIFT INFORMATION CARD
              // =========================================================

              Container(
                width: double.infinity,

                padding:
                    const EdgeInsets
                        .symmetric(
                  horizontal: 20,
                  vertical: 18,
                ),

                decoration:
                    BoxDecoration(
                  borderRadius:
                      BorderRadius.circular(
                    16,
                  ),

                  image:
                      const DecorationImage(
                    image: AssetImage(
                      'assets/images/back-img.png',
                    ),
                    fit: BoxFit.cover,
                  ),
                ),

                child: Column(
                  crossAxisAlignment:
                      CrossAxisAlignment
                          .start,

                  children: [
                    Row(
                      mainAxisAlignment:
                          MainAxisAlignment
                              .spaceBetween,

                      children: [
                        Container(
                          padding:
                              const EdgeInsets
                                  .symmetric(
                            horizontal: 10,
                            vertical: 4,
                          ),

                          decoration:
                              BoxDecoration(
                            color: Colors
                                .white
                                .withValues(
                              alpha: 0.2,
                            ),
                            borderRadius:
                                BorderRadius
                                    .circular(
                              20,
                            ),
                          ),

                          child:
                              const Text(
                            'BOOTH 1',
                            style:
                                TextStyle(
                              fontFamily:
                                  'Outfit',
                              color:
                                  Colors.white,
                              fontSize:
                                  12,
                              fontWeight:
                                  FontWeight
                                      .w700,
                            ),
                          ),
                        ),

                        GestureDetector(
                          onTap: () {},

                          child: Row(
                            children:
                                const [
                              Text(
                                'Detail',
                                style:
                                    TextStyle(
                                  color:
                                      Colors.white,
                                  fontWeight:
                                      FontWeight
                                          .w600,
                                  fontSize:
                                      14,
                                ),
                              ),

                              SizedBox(
                                width: 4,
                              ),

                              Icon(
                                Icons
                                    .chevron_right,
                                color:
                                    Colors.white,
                                size: 18,
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),

                    const SizedBox(
                      height: 10,
                    ),

                    const Text(
                      'SHIFT 1 AKTIF',
                      style:
                          TextStyle(
                        fontFamily:
                            'Outfit',
                        color:
                            Colors.white,
                        fontSize: 24,
                        fontWeight:
                            FontWeight
                                .w900,
                        letterSpacing:
                            0.5,
                      ),
                    ),

                    const SizedBox(
                      height: 4,
                    ),

                    Row(
                      children:
                          const [
                        Icon(
                          Icons
                              .access_time,
                          color:
                              Color(
                            0xCCFFFFFF,
                          ),
                          size: 14,
                        ),

                        SizedBox(
                          width: 6,
                        ),

                        Text(
                          '08.00 - 16.30 WIB',
                          style:
                              TextStyle(
                            fontFamily:
                                'Outfit',
                            color:
                                Color(
                              0xCCFFFFFF,
                            ),
                            fontSize:
                                14,
                            fontWeight:
                                FontWeight
                                    .w600,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),

              const SizedBox(
                height: 16,
              ),

              // =========================================================
              // 2. ORANGE ACTION BANNER - INCOMING STOCK
              // =========================================================

              if (appState.pendingInbound !=
                  null)
                Container(
                  width:
                      double.infinity,

                  padding:
                      const EdgeInsets
                          .symmetric(
                    horizontal: 20,
                    vertical: 20,
                  ),

                  decoration:
                      BoxDecoration(
                    color:
                        const Color(
                      0xFFFFF9F5,
                    ),

                    borderRadius:
                        BorderRadius.circular(
                      18,
                    ),

                    border: Border.all(
                      color:
                          const Color(
                        0xFFFFDEC9,
                      ),
                      width: 1.5,
                    ),

                    boxShadow: [
                      BoxShadow(
                        color: ObbelTheme
                            .accentOrange
                            .withValues(
                          alpha: 0.04,
                        ),
                        blurRadius: 12,
                        offset:
                            const Offset(
                          0,
                          6,
                        ),
                      ),
                    ],
                  ),

                  child: Column(
                    crossAxisAlignment:
                        CrossAxisAlignment
                            .start,

                    children: [
                      Row(
                        crossAxisAlignment:
                            CrossAxisAlignment
                                .start,

                        children: [
                          Container(
                            padding:
                                const EdgeInsets
                                    .all(
                              12,
                            ),

                            decoration:
                                BoxDecoration(
                              color:
                                  Colors.white,
                              shape:
                                  BoxShape
                                      .circle,

                              boxShadow: [
                                BoxShadow(
                                  color: ObbelTheme
                                      .accentOrange
                                      .withValues(
                                    alpha:
                                        0.12,
                                  ),
                                  blurRadius:
                                      8,
                                  spreadRadius:
                                      1,
                                ),
                              ],
                            ),

                            child:
                                CustomPaint(
                              size:
                                  const Size(
                                28,
                                28,
                              ),
                              painter:
                                  ObbelIconPainter(
                                iconType:
                                    'box_open',
                                color:
                                    ObbelTheme
                                        .accentOrange,
                              ),
                            ),
                          ),

                          const SizedBox(
                            width: 16,
                          ),

                          Expanded(
                            child: Column(
                              crossAxisAlignment:
                                  CrossAxisAlignment
                                      .start,

                              children: [
                                Row(
                                  mainAxisAlignment:
                                      MainAxisAlignment
                                          .spaceBetween,

                                  children: [
                                    const Text(
                                      'Ada stok masuk',
                                      style:
                                          TextStyle(
                                        fontFamily:
                                            'Outfit',
                                        fontSize:
                                            18,
                                        fontWeight:
                                            FontWeight
                                                .w900,
                                        color:
                                            ObbelTheme
                                                .textDark,
                                      ),
                                    ),

                                    Container(
                                      padding:
                                          const EdgeInsets
                                              .symmetric(
                                        horizontal:
                                            10,
                                        vertical:
                                            4,
                                      ),

                                      decoration:
                                          BoxDecoration(
                                        color:
                                            ObbelTheme
                                                .accentOrange,
                                        borderRadius:
                                            BorderRadius
                                                .circular(
                                          8,
                                        ),
                                      ),

                                      child:
                                          const Text(
                                        'PENTING',
                                        style:
                                            TextStyle(
                                          fontFamily:
                                              'Outfit',
                                          fontSize:
                                              10,
                                          fontWeight:
                                              FontWeight
                                                  .w900,
                                          color:
                                              Colors
                                                  .white,
                                        ),
                                      ),
                                    ),
                                  ],
                                ),

                                const Text(
                                  'untuk Shift 1',
                                  style:
                                      TextStyle(
                                    fontFamily:
                                        'Outfit',
                                    fontSize:
                                        18,
                                    fontWeight:
                                        FontWeight
                                            .w900,
                                    color:
                                        ObbelTheme
                                            .textDark,
                                    height:
                                        1.1,
                                  ),
                                ),

                                const SizedBox(
                                  height: 8,
                                ),

                                const Text(
                                  'Silakan periksa & terima stok fisik untuk update inventaris dan mulai penjualan booth hari ini.',
                                  style:
                                      TextStyle(
                                    fontSize:
                                        13,
                                    color:
                                        ObbelTheme
                                            .textLight,
                                    fontWeight:
                                        FontWeight
                                            .w600,
                                    height:
                                        1.35,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),

                      const SizedBox(
                        height: 20,
                      ),

                      SizedBox(
                        width:
                            double.infinity,

                        child:
                            ElevatedButton(
                          style:
                              ElevatedButton
                                  .styleFrom(
                            backgroundColor:
                                ObbelTheme
                                    .accentOrange,

                            padding:
                                const EdgeInsets
                                    .symmetric(
                              vertical: 16,
                            ),

                            shape:
                                RoundedRectangleBorder(
                              borderRadius:
                                  BorderRadius
                                      .circular(
                                12,
                              ),
                            ),

                            elevation: 0,
                          ),

                          onPressed: () {
                            Navigator
                                .pushNamed(
                              context,
                              '/inbound',
                            );
                          },

                          child: Row(
                            mainAxisAlignment:
                                MainAxisAlignment
                                    .center,

                            children:
                                const [
                              Text(
                                'Lihat & Terima Stok',
                                style:
                                    TextStyle(
                                  fontFamily:
                                      'Outfit',
                                  fontWeight:
                                      FontWeight
                                          .bold,
                                  fontSize:
                                      15,
                                  color:
                                      Colors
                                          .white,
                                ),
                              ),

                              SizedBox(
                                width: 8,
                              ),

                              Icon(
                                Icons
                                    .arrow_forward,
                                color:
                                    Colors.white,
                                size: 18,
                              ),
                            ],
                          ),
                        ),
                      ),
                    ],
                  ),
                ),

              const SizedBox(
                height: 16,
              ),

              // =========================================================
              // 3. PERINGATAN STOK BOOTH
              // =========================================================

              Container(
                width:
                    double.infinity,

                padding:
                    const EdgeInsets.all(
                  16,
                ),

                decoration:
                    BoxDecoration(
                  color:
                      Colors.white,

                  borderRadius:
                      BorderRadius.circular(
                    16,
                  ),

                  border: Border.all(
                    color:
                        Colors.grey.shade200,
                    width: 1.2,
                  ),

                  boxShadow: [
                    BoxShadow(
                      color:
                          Colors.black
                              .withValues(
                        alpha: 0.02,
                      ),
                      blurRadius: 10,
                      offset:
                          const Offset(
                        0,
                        4,
                      ),
                    ),
                  ],
                ),

                child: Column(
                  crossAxisAlignment:
                      CrossAxisAlignment
                          .start,

                  children: [
                    // ===================================================
                    // HEADER
                    // ===================================================

                    Row(
                      mainAxisAlignment:
                          MainAxisAlignment
                              .spaceBetween,

                      children: [
                        Row(
                          children:
                              const [
                            Icon(
                              Icons
                                  .warning_amber_rounded,
                              color:
                                  Colors
                                      .redAccent,
                              size: 20,
                            ),

                            SizedBox(
                              width: 8,
                            ),

                            Text(
                              'Peringatan Stok Booth',
                              style:
                                  TextStyle(
                                fontSize:
                                    15,
                                fontWeight:
                                    FontWeight
                                        .bold,
                                color:
                                    ObbelTheme
                                        .textDark,
                              ),
                            ),
                          ],
                        ),

                        Container(
                          padding:
                              const EdgeInsets
                                  .symmetric(
                            horizontal: 10,
                            vertical: 4,
                          ),

                          decoration:
                              BoxDecoration(
                            color: Colors
                                .red
                                .shade50,

                            borderRadius:
                                BorderRadius
                                    .circular(
                              20,
                            ),

                            border:
                                Border.all(
                              color: Colors
                                  .red
                                  .shade200,
                            ),
                          ),

                          child:
                              const Text(
                            '4 ITEM ALERT',
                            style:
                                TextStyle(
                              fontSize:
                                  10,
                              fontWeight:
                                  FontWeight
                                      .w900,
                              color:
                                  Colors
                                      .redAccent,
                            ),
                          ),
                        ),
                      ],
                    ),

                    const SizedBox(
                      height: 4,
                    ),

                    const Padding(
                      padding:
                          EdgeInsets.only(
                        left: 28.0,
                      ),

                      child: Text(
                        'Perlu perhatian & tindakan segera',
                        style:
                            TextStyle(
                          fontSize:
                              12,
                          color:
                              ObbelTheme
                                  .textLight,
                        ),
                      ),
                    ),

                    const SizedBox(
                      height: 14,
                    ),

                    // ===================================================
                    // STOCK STATUS
                    // ===================================================

                    Row(
                      children: [
                        Expanded(
                          child:
                              _buildStockSubCard(
                            count: '2',
                            label:
                                'Habis (0 cup)',
                            borderColor:
                                Colors
                                    .red
                                    .shade200,
                            textColor:
                                Colors
                                    .redAccent,
                            bgColor:
                                Colors
                                    .red
                                    .shade50
                                    .withValues(
                                  alpha:
                                      0.5,
                                ),
                          ),
                        ),

                        const SizedBox(
                          width: 8,
                        ),

                        Expanded(
                          child:
                              _buildStockSubCard(
                            count: '4',
                            label:
                                'Kritis',
                            borderColor:
                                Colors
                                    .orange
                                    .shade200,
                            textColor:
                                ObbelTheme
                                    .accentOrange,
                            bgColor:
                                Colors
                                    .orange
                                    .shade50
                                    .withValues(
                                  alpha:
                                      0.3,
                                ),
                          ),
                        ),

                        const SizedBox(
                          width: 8,
                        ),

                        Expanded(
                          child:
                              _buildStockSubCard(
                            count: '1',
                            label:
                                'Menipis',
                            borderColor:
                                Colors
                                    .yellow
                                    .shade300,
                            textColor:
                                Colors
                                    .amber
                                    .shade800,
                            bgColor:
                                Colors
                                    .yellow
                                    .shade50
                                    .withValues(
                                  alpha:
                                      0.3,
                                ),
                          ),
                        ),
                      ],
                    ),

                    const SizedBox(
                      height: 14,
                    ),

                    const Divider(
                      height: 1,
                    ),

                    const SizedBox(
                      height: 10,
                    ),

                    // ===================================================
                    // ACTION
                    // ===================================================

                    Row(
                      mainAxisAlignment:
                          MainAxisAlignment
                              .spaceBetween,

                      children: [
                        TextButton(
                          onPressed: () {
                            // Bisa diarahkan ke notifikasi
                            // jika diperlukan.
                          },

                          style:
                              TextButton
                                  .styleFrom(
                            padding:
                                EdgeInsets
                                    .zero,
                            minimumSize:
                                Size.zero,
                            tapTargetSize:
                                MaterialTapTargetSize
                                    .shrinkWrap,
                          ),

                          child:
                              const Text(
                            'Buka Notifikasi Stok (4 Item)',
                            style:
                                TextStyle(
                              fontSize:
                                  13,
                              fontWeight:
                                  FontWeight
                                      .bold,
                              color:
                                  ObbelTheme
                                      .textDark,
                            ),
                          ),
                        ),

                        // =================================================
                        // TOMBOL AJUKAN RESTOCK
                        // =================================================

                        ElevatedButton.icon(
                          onPressed:
                              _openStock,

                          style:
                              ElevatedButton
                                  .styleFrom(
                            backgroundColor:
                                const Color(
                              0xFF0E6F3F,
                            ),

                            padding:
                                const EdgeInsets
                                    .symmetric(
                              horizontal: 12,
                              vertical: 8,
                            ),

                            elevation: 0,

                            shape:
                                RoundedRectangleBorder(
                              borderRadius:
                                  BorderRadius
                                      .circular(
                                8,
                              ),
                            ),
                          ),

                          icon:
                              const Icon(
                            Icons
                                .local_shipping_outlined,
                            size: 16,
                            color:
                                Colors.white,
                          ),

                          label:
                              const Text(
                            'Ajukan Restock',
                            style:
                                TextStyle(
                              fontSize:
                                  12,
                              fontWeight:
                                  FontWeight
                                      .bold,
                              color:
                                  Colors.white,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),

              const SizedBox(
                height: 24,
              ),

              // =========================================================
              // 4. SUMMARY SECTION
              // =========================================================

              const Text(
                'Kinerja Booth Hari Ini',
                style:
                    TextStyle(
                  fontSize: 16,
                  fontWeight:
                      FontWeight.w800,
                  color:
                      ObbelTheme
                          .textDark,
                ),
              ),

              const SizedBox(
                height: 14,
              ),

              // =========================================================
              // 5. GRID METRICS
              // =========================================================

              GridView.count(
                crossAxisCount: 2,
                crossAxisSpacing: 12,
                mainAxisSpacing: 12,
                shrinkWrap: true,
                physics:
                    const NeverScrollableScrollPhysics(),
                childAspectRatio: 1.15,

                children: [
                  _buildMetricCard(
                    title:
                        'Penjualan Hari Ini',
                    value:
                        'Rp 1.250.000',
                    iconName:
                        'home',
                    valueFontSize:
                        18,
                    extraWidget:
                        Padding(
                      padding:
                          const EdgeInsets
                              .only(
                        top: 4.0,
                      ),
                      child:
                          CustomPaint(
                        size:
                            const Size(
                          double.infinity,
                          16,
                        ),
                        painter:
                            SparklinePainter(),
                      ),
                    ),
                  ),

                  _buildMetricCard(
                    title:
                        'Cup Terjual',
                    value:
                        '84 cup',
                    iconName:
                        'document_code',
                    valueFontSize:
                        20,
                    extraWidget:
                        Column(
                      crossAxisAlignment:
                          CrossAxisAlignment
                              .start,
                      children: [
                        const SizedBox(
                          height: 6,
                        ),

                        ClipRRect(
                          borderRadius:
                              BorderRadius
                                  .circular(
                            4,
                          ),
                          child:
                              LinearProgressIndicator(
                            value: 0.7,
                            backgroundColor:
                                Colors
                                    .grey
                                    .shade200,
                            valueColor:
                                const AlwaysStoppedAnimation<
                                    Color>(
                              Color(
                                0xFF0E6F3F,
                              ),
                            ),
                            minHeight: 5,
                          ),
                        ),

                        const SizedBox(
                          height: 4,
                        ),

                        const Text(
                          'Target: 120 cup (70%)',
                          style:
                              TextStyle(
                            fontSize:
                                10,
                            color:
                                ObbelTheme
                                    .textLight,
                            fontWeight:
                                FontWeight
                                    .w500,
                          ),
                        ),
                      ],
                    ),
                  ),

                  _buildMetricCard(
                    title:
                        'Stok Alert',
                    value:
                        '4 item',
                    iconName:
                        'warning',
                    isWarning:
                        true,
                    valueFontSize:
                        22,
                    extraWidget:
                        Padding(
                      padding:
                          const EdgeInsets
                              .only(
                        top: 4.0,
                      ),
                      child:
                          Container(
                        padding:
                            const EdgeInsets
                                .symmetric(
                          horizontal:
                              6,
                          vertical:
                              2,
                        ),
                        decoration:
                            BoxDecoration(
                          color:
                              const Color(
                            0xFFFFF9F5,
                          ),
                          borderRadius:
                              BorderRadius
                                  .circular(
                            4,
                          ),
                          border:
                              Border.all(
                            color:
                                const Color(
                              0xFFFFDEC9,
                            ),
                            width: 1,
                          ),
                        ),
                        child:
                            const Text(
                          'Perlu restock segera',
                          style:
                              TextStyle(
                            fontSize:
                                9,
                            fontWeight:
                                FontWeight
                                    .w700,
                            color:
                                ObbelTheme
                                    .accentOrange,
                          ),
                        ),
                      ),
                    ),
                  ),

                  _buildMetricCard(
                    title:
                        'Transaksi',
                    value:
                        '42 order',
                    iconName:
                        'document',
                    valueFontSize:
                        20,
                    extraWidget:
                        const Padding(
                      padding:
                          EdgeInsets
                              .only(
                        top: 4.0,
                      ),
                      child:
                          Text(
                        'QRIS (28) • Tunai (14)',
                        style:
                            TextStyle(
                          fontSize:
                              10,
                          color:
                              ObbelTheme
                                  .textLight,
                          fontWeight:
                              FontWeight
                                  .w500,
                        ),
                        maxLines:
                            1,
                        overflow:
                            TextOverflow
                                .ellipsis,
                      ),
                    ),
                  ),
                ],
              ),

              const SizedBox(
                height: 24,
              ),

              // =========================================================
              // 6. PESANAN TERAKHIR
              // =========================================================

              Row(
                mainAxisAlignment:
                    MainAxisAlignment
                        .spaceBetween,

                children: [
                  const Text(
                    'Pesanan Terakhir',
                    style:
                        TextStyle(
                      fontSize: 16,
                      fontWeight:
                          FontWeight
                              .w800,
                      color:
                          ObbelTheme
                              .textDark,
                    ),
                  ),

                  TextButton(
                    onPressed: () {},

                    style:
                        TextButton
                            .styleFrom(
                      padding:
                          EdgeInsets.zero,
                      minimumSize:
                          Size.zero,
                      tapTargetSize:
                          MaterialTapTargetSize
                              .shrinkWrap,
                    ),

                    child:
                        const Text(
                      'Lihat Semua',
                      style:
                          TextStyle(
                        fontSize: 13,
                        fontWeight:
                            FontWeight
                                .bold,
                        color:
                            Color(
                          0xFF0E6F3F,
                        ),
                      ),
                    ),
                  ),
                ],
              ),

              const SizedBox(
                height: 12,
              ),

              _buildOrderCard(
                orderId: '#42',
                title:
                    '2x Obbel Aren Latte',
                meta:
                    '13.48 • QRIS Sukses',
                price:
                    'Rp 36.000',
              ),

              const SizedBox(
                height: 10,
              ),

              _buildOrderCard(
                orderId: '#41',
                title:
                    '1x Pandan Tea Cheese',
                meta:
                    '13.42 • Tunai Pas',
                price:
                    'Rp 18.000',
              ),

              const SizedBox(
                height: 20,
              ),
            ],
          ),
        ),
      ),
    );
  }

  // ===================================================================
  // STOCK SUB CARD
  // ===================================================================

  Widget _buildStockSubCard({
    required String count,
    required String label,
    required Color borderColor,
    required Color textColor,
    required Color bgColor,
  }) {
    return Container(
      padding:
          const EdgeInsets.symmetric(
        vertical: 10,
        horizontal: 6,
      ),

      decoration:
          BoxDecoration(
        color: bgColor,
        borderRadius:
            BorderRadius.circular(12),
        border: Border.all(
          color: borderColor,
          width: 1,
        ),
      ),

      child: Column(
        children: [
          Text(
            count,
            style: TextStyle(
              fontFamily:
                  'Outfit',
              fontSize: 18,
              fontWeight:
                  FontWeight.w900,
              color: textColor,
            ),
          ),

          const SizedBox(
            height: 2,
          ),

          Text(
            label,
            style: TextStyle(
              fontSize: 11,
              fontWeight:
                  FontWeight.w600,
              color: textColor,
            ),
            textAlign:
                TextAlign.center,
            maxLines: 1,
            overflow:
                TextOverflow.ellipsis,
          ),
        ],
      ),
    );
  }

  // ===================================================================
  // METRIC CARD
  // ===================================================================

  Widget _buildMetricCard({
    required String title,
    required String value,
    required String iconName,
    Widget? extraWidget,
    bool isWarning = false,
    double? valueFontSize,
  }) {
    return Container(
      padding:
          const EdgeInsets.symmetric(
        horizontal: 14,
        vertical: 12,
      ),

      decoration:
          BoxDecoration(
        color: Colors.white,

        borderRadius:
            BorderRadius.circular(16),

        border: Border.all(
          color: isWarning
              ? ObbelTheme
                  .accentOrange
                  .withValues(
                alpha: 0.3,
              )
              : Colors.grey.shade200,
          width: 1.2,
        ),

        boxShadow: [
          BoxShadow(
            color:
                Colors.black.withValues(
              alpha: 0.02,
            ),
            blurRadius: 10,
            offset:
                const Offset(0, 4),
          ),
        ],
      ),

      child: Column(
        crossAxisAlignment:
            CrossAxisAlignment.start,

        mainAxisAlignment:
            MainAxisAlignment
                .spaceBetween,

        children: [
          Row(
            mainAxisAlignment:
                MainAxisAlignment
                    .spaceBetween,

            children: [
              Expanded(
                child: Text(
                  title,
                  style:
                      const TextStyle(
                    fontSize: 12,
                    fontWeight:
                        FontWeight.bold,
                    color:
                        ObbelTheme
                            .textLight,
                  ),
                  maxLines: 1,
                  overflow:
                      TextOverflow
                          .ellipsis,
                ),
              ),

              CustomPaint(
                size:
                    const Size(22, 22),

                painter:
                    ObbelIconPainter(
                  iconType:
                      iconName,
                  color: isWarning
                      ? ObbelTheme
                          .accentOrange
                      : const Color(
                          0xFFC4C9C6,
                        ),
                ),
              ),
            ],
          ),

          Column(
            crossAxisAlignment:
                CrossAxisAlignment
                    .start,

            children: [
              Text(
                value,
                style:
                    TextStyle(
                  fontFamily:
                      'Outfit',
                  fontSize:
                      valueFontSize ??
                          22,
                  fontWeight:
                      FontWeight.w900,
                  color: isWarning
                      ? ObbelTheme
                          .accentOrange
                      : ObbelTheme
                          .textDark,
                ),
                maxLines: 1,
                overflow:
                    TextOverflow
                        .ellipsis,
              ),

              if (extraWidget != null)
                extraWidget,
            ],
          ),
        ],
      ),
    );
  }

  // ===================================================================
  // ORDER CARD
  // ===================================================================

  Widget _buildOrderCard({
    required String orderId,
    required String title,
    required String meta,
    required String price,
  }) {
    return Container(
      padding:
          const EdgeInsets.all(14),

      decoration:
          BoxDecoration(
        color: Colors.white,

        borderRadius:
            BorderRadius.circular(16),

        border: Border.all(
          color: Colors.grey.shade200,
          width: 1.2,
        ),

        boxShadow: [
          BoxShadow(
            color:
                Colors.black.withValues(
              alpha: 0.02,
            ),
            blurRadius: 10,
            offset:
                const Offset(0, 4),
          ),
        ],
      ),

      child: Row(
        children: [
          Container(
            padding:
                const EdgeInsets.symmetric(
              horizontal: 10,
              vertical: 8,
            ),

            decoration:
                BoxDecoration(
              color:
                  const Color(0xFFE8F5E9),
              borderRadius:
                  BorderRadius.circular(
                10,
              ),
            ),

            child: Text(
              orderId,
              style:
                  const TextStyle(
                fontFamily:
                    'Outfit',
                fontWeight:
                    FontWeight.w900,
                fontSize: 14,
                color:
                    Color(0xFF0E6F3F),
              ),
            ),
          ),

          const SizedBox(
            width: 12,
          ),

          Expanded(
            child: Column(
              crossAxisAlignment:
                  CrossAxisAlignment
                      .start,

              children: [
                Text(
                  title,
                  style:
                      const TextStyle(
                    fontWeight:
                        FontWeight.bold,
                    fontSize: 14,
                    color:
                        ObbelTheme
                            .textDark,
                  ),
                ),

                const SizedBox(
                  height: 2,
                ),

                Text(
                  meta,
                  style:
                      const TextStyle(
                    fontSize: 11,
                    color:
                        ObbelTheme
                            .textLight,
                    fontWeight:
                        FontWeight.w500,
                  ),
                ),
              ],
            ),
          ),

          Text(
            price,
            style:
                const TextStyle(
              fontFamily:
                  'Outfit',
              fontWeight:
                  FontWeight.w800,
              fontSize: 14,
              color:
                  ObbelTheme.textDark,
            ),
          ),
        ],
      ),
    );
  }
}

// =====================================================================
// SPARKLINE PAINTER
// =====================================================================

class SparklinePainter
    extends CustomPainter {
  @override
  void paint(
    Canvas canvas,
    Size size,
  ) {
    final paint = Paint()
      ..color =
          const Color(0xFF0E6F3F)
      ..style =
          PaintingStyle.stroke
      ..strokeWidth = 2.0
      ..strokeCap =
          StrokeCap.round;

    final path = Path();

    path.moveTo(
      0,
      size.height * 0.8,
    );

    path.lineTo(
      size.width * 0.2,
      size.height * 0.6,
    );

    path.lineTo(
      size.width * 0.4,
      size.height * 0.7,
    );

    path.lineTo(
      size.width * 0.6,
      size.height * 0.5,
    );

    path.lineTo(
      size.width * 0.8,
      size.height * 0.55,
    );

    path.lineTo(
      size.width,
      size.height * 0.2,
    );

    canvas.drawPath(
      path,
      paint,
    );
  }

  @override
  bool shouldRepaint(
    covariant CustomPainter oldDelegate,
  ) {
    return false;
  }
}