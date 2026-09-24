import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../app_state.dart';

class OrderRecord {
  final String orderNo;
  final String itemsSummary;
  final String time;
  final String paymentLabel;
  final bool paymentSuccess;
  final int total;

  const OrderRecord({
    required this.orderNo,
    required this.itemsSummary,
    required this.time,
    required this.paymentLabel,
    required this.paymentSuccess,
    required this.total,
  });
}

class DayGroup {
  final String label;
  final bool isToday;
  final int transactionCount;
  final int? totalOmzet;
  final List<OrderRecord> orders;

  const DayGroup({
    required this.label,
    required this.isToday,
    required this.transactionCount,
    this.totalOmzet,
    required this.orders,
  });
}

/* Legacy fixture retained for reference only; runtime history uses AppState.sales.
final List<DayGroup> _dummyHistory = [
  DayGroup(
    label: 'Hari Ini, 24 Okt 2024',
    isToday: true,
    transactionCount: 38,
    orders: const [
      OrderRecord(
        orderNo: '#42',
        itemsSummary: '2x Obbel Aren Latte',
        time: '13.48',
        paymentLabel: 'QRIS Sukses',
        paymentSuccess: true,
        total: 36000,
      ),
      OrderRecord(
        orderNo: '#41',
        itemsSummary: '1x Pandan Tea Cheese',
        time: '13.42',
        paymentLabel: 'Tunai Pas',
        paymentSuccess: false,
        total: 18000,
      ),
      OrderRecord(
        orderNo: '#40',
        itemsSummary: '3x Brown Sugar Boba Fresh Milk',
        time: '13.15',
        paymentLabel: 'Tunai (Kembali Rp 10rb)',
        paymentSuccess: false,
        total: 60000,
      ),
      OrderRecord(
        orderNo: '#39',
        itemsSummary: '1x Earl Grey Tea + 1x Toast',
        time: '12.50',
        paymentLabel: 'QRIS Sukses',
        paymentSuccess: true,
        total: 29000,
      ),
    ],
  ),
  DayGroup(
    label: 'Kemarin, 23 Okt 2024',
    isToday: false,
    transactionCount: 45,
    totalOmzet: 1340000,
    orders: const [
      OrderRecord(
        orderNo: '#45',
        itemsSummary: '4x Obbel Aren Latte (Large)',
        time: '21.40',
        paymentLabel: 'QRIS Sukses',
        paymentSuccess: true,
        total: 88000,
      ),
      OrderRecord(
        orderNo: '#44',
        itemsSummary: '1x Americano Cold • Less Ice',
        time: '21.15',
        paymentLabel: 'Tunai Pas',
        paymentSuccess: false,
        total: 15000,
      ),
    ],
  ),
];
*/

class _HistoryColors {
  static const primary = Color(0xFF0E6F3F);
  static const primaryDark = Color(0xFF0A5A32);
  static const accentText = Color(0xFF0B7A45);
  static const accentBg = Color(0xFFE3F5EA);
  static const accentBorder = Color(0xFFBFE8CE);
  static const background = Color(0xFFF5F8F6);
  static const cardBorder = Color(0xFFE4EAE6);
  static const textDark = Color(0xFF16241C);
  static const textBody = Color(0xFF3B4A42);
  static const textMuted = Color(0xFF6E8078);
  static const textHint = Color(0xFF93A69C);
  static const orangeText = Color(0xFFB8792A);
}

const _dateFilters = ['Hari Ini', 'Kemarin', '7 Hari Terakhir'];

class HistoryScreen extends StatefulWidget {
  const HistoryScreen({super.key});

  @override
  State<HistoryScreen> createState() => _HistoryScreenState();
}

class _HistoryScreenState extends State<HistoryScreen> {
  String _selectedFilter = 'Hari Ini';
  DateTime? _selectedDate;
  final TextEditingController _searchController = TextEditingController();
  String _query = '';

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  String _formatRupiah(int value) {
    final digits = value.abs().toString();
    final buffer = StringBuffer();

    for (var i = 0; i < digits.length; i++) {
      if (i > 0 && (digits.length - i) % 3 == 0) {
        buffer.write('.');
      }
      buffer.write(digits[i]);
    }

    return 'Rp $buffer';
  }

  @override
  Widget build(BuildContext context) {
    final appState = context.watch<AppState>();
    final query = _query.trim().toLowerCase();
    final dateSales = appState.sales.where(_matchesSelectedFilter).toList();
    final groups = _buildGroups(dateSales, query);
    final totalOmzet = dateSales.fold(0, (sum, sale) => sum + sale.total);
    final qrisSales = dateSales.where((sale) => sale.paymentMethod == 'QRIS');
    final tunaiSales = dateSales.where((sale) => sale.paymentMethod != 'QRIS');
    final qrisTotal = qrisSales.fold(0, (sum, sale) => sum + sale.total);
    final tunaiTotal = tunaiSales.fold(0, (sum, sale) => sum + sale.total);
    final qrisCount = qrisSales.length;
    final tunaiCount = tunaiSales.length;
    final totalTransactions = dateSales.length;
    final qrisPercent = totalTransactions == 0
        ? 0
        : (qrisCount * 100 / totalTransactions).round();
    final tunaiPercent = totalTransactions == 0
        ? 0
        : (tunaiCount * 100 / totalTransactions).round();

    return Scaffold(
      backgroundColor: _HistoryColors.background,
      body: SafeArea(
        child: Column(
          children: [
            _buildHeader(),
            _buildSearchAndFilter(),
            Expanded(
              child: groups.isEmpty
                  ? _buildEmptyState()
                  : ListView(
                      padding: const EdgeInsets.fromLTRB(16, 16, 16, 12),
                      children: [
                        _buildSummaryCard(
                          totalOmzet: totalOmzet,
                          totalTransaksi: totalTransactions,
                          qrisTotal: qrisTotal,
                          qrisCount: qrisCount,
                          qrisPercent: qrisPercent,
                          tunaiTotal: tunaiTotal,
                          tunaiCount: tunaiCount,
                          tunaiPercent: tunaiPercent,
                        ),
                        const SizedBox(height: 20),
                        for (final group in groups) ...[
                          _buildDayHeader(group),
                          const SizedBox(height: 10),
                          _buildOrderList(group),
                          const SizedBox(height: 20),
                        ],
                        _buildDownloadButton(),
                      ],
                    ),
            ),
          ],
        ),
      ),
    );
  }

  bool _matchesSelectedFilter(SaleHistoryRecord sale) {
    if (_selectedDate != null) {
      return _sameDate(sale.paidAt, _selectedDate!);
    }

    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final saleDate = DateTime(
      sale.paidAt.year,
      sale.paidAt.month,
      sale.paidAt.day,
    );
    final difference = today.difference(saleDate).inDays;

    switch (_selectedFilter) {
      case 'Kemarin':
        return difference == 1;
      case '7 Hari Terakhir':
        return difference >= 0 && difference < 7;
      case 'Hari Ini':
      default:
        return difference == 0;
    }
  }

  bool _sameDate(DateTime first, DateTime second) {
    return first.year == second.year &&
        first.month == second.month &&
        first.day == second.day;
  }

  Future<void> _pickDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _selectedDate ?? DateTime.now(),
      firstDate: DateTime(2020),
      lastDate: DateTime.now(),
      helpText: 'Pilih tanggal penjualan',
      cancelText: 'Batal',
      confirmText: 'Pilih',
    );
    if (!mounted || picked == null) return;
    setState(() {
      _selectedDate = picked;
      _selectedFilter = 'Pilih Tanggal';
    });
  }

  void _selectDateFilter(String label) {
    setState(() {
      _selectedDate = null;
      _selectedFilter = label;
    });
  }

  List<DayGroup> _buildGroups(
    List<SaleHistoryRecord> sales,
    String query,
  ) {
    final grouped = <DateTime, List<SaleHistoryRecord>>{};
    for (final sale in sales) {
      final date = DateTime(sale.paidAt.year, sale.paidAt.month, sale.paidAt.day);
      grouped.putIfAbsent(date, () => []).add(sale);
    }

    final dates = grouped.keys.toList()..sort((a, b) => b.compareTo(a));
    return dates.map((date) {
      final allSales = grouped[date]!;
      final orders = allSales.map(_toOrderRecord).where((order) {
        return query.isEmpty ||
            order.orderNo.toLowerCase().contains(query) ||
            order.itemsSummary.toLowerCase().contains(query) ||
            order.paymentLabel.toLowerCase().contains(query);
      }).toList();
      final total = allSales.fold(0, (sum, sale) => sum + sale.total);
      final isToday = date == DateTime.now().copyWith(
        hour: 0,
        minute: 0,
        second: 0,
        millisecond: 0,
        microsecond: 0,
      );

      return DayGroup(
        label: _formatDayLabel(date, isToday),
        isToday: isToday,
        transactionCount: allSales.length,
        totalOmzet: total,
        orders: orders,
      );
    }).where((group) => group.orders.isNotEmpty).toList();
  }

  OrderRecord _toOrderRecord(SaleHistoryRecord sale) {
    final paymentIsQris = sale.paymentMethod == 'QRIS';
    final isVoided = sale.status == 'VOIDED';
    final displaySaleNo = sale.saleNo.length > 4
        ? sale.saleNo.substring(sale.saleNo.length - 4)
        : sale.saleNo;
    return OrderRecord(
      orderNo: '#$displaySaleNo',
      itemsSummary: sale.items
          .map((item) => '${item.qty}x ${item.productName}')
          .join(' + '),
      time: '${sale.paidAt.hour.toString().padLeft(2, '0')}.${sale.paidAt.minute.toString().padLeft(2, '0')}',
      paymentLabel: isVoided
          ? 'Dibatalkan'
          : paymentIsQris
              ? 'QRIS Sukses'
              : 'Tunai',
      paymentSuccess: paymentIsQris && !isVoided,
      total: sale.total,
    );
  }

  String _formatDayLabel(DateTime date, bool isToday) {
    const months = [
      'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
      'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des',
    ];
    if (isToday) return 'Hari Ini, ${date.day} ${months[date.month - 1]} ${date.year}';
    return '${date.day} ${months[date.month - 1]} ${date.year}';
  }

  Widget _buildHeader() {
    return Container(
      width: double.infinity,
      height: 64,
      color: const Color(0xFF07563D),
      padding: const EdgeInsets.symmetric(horizontal: 18),
      child: Row(
        children: [
          GestureDetector(
            onTap: () => Navigator.pop(context),
            child: const Icon(
              Icons.arrow_back,
              color: Color(0xFFB8EEDB),
              size: 24,
            ),
          ),
          const SizedBox(width: 14),
          const Text(
            'Riwayat Penjualan',
            style: TextStyle(
              color: Colors.white,
              fontSize: 20,
              fontWeight: FontWeight.w800,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSearchAndFilter() {
    final todayCount = context
        .read<AppState>()
        .sales
        .where(_matchesSelectedFilter)
        .length;

    return Container(
      width: double.infinity,
      color: Colors.white,
      padding: const EdgeInsets.fromLTRB(20, 14, 20, 12),
      child: Column(
        children: [
          Container(
            height: 48,
            decoration: BoxDecoration(
              color: const Color(0xFFF1F5F7),
              borderRadius: BorderRadius.circular(14),
              border: Border.all(
                color: const Color(0xFFDCE5EA),
              ),
            ),
            child: TextField(
              controller: _searchController,
              onChanged: (value) => setState(() => _query = value),
              decoration: InputDecoration(
                hintText: 'Cari no. pesanan (#42), menu, atau metode',
                hintStyle: TextStyle(
                  color: Color(0xFF8FA1B5),
                  fontSize: 13.5,
                  fontWeight: FontWeight.w500,
                ),
                prefixIcon: Icon(
                  Icons.search,
                  color: Color(0xFF8FA1B5),
                  size: 22,
                ),
                suffixIcon: IconButton(
                  tooltip: 'Filter tanggal',
                  onPressed: _pickDate,
                  icon: const Icon(
                    Icons.filter_list_rounded,
                    color: Color(0xFF8FA1B5),
                    size: 22,
                  ),
                ),
                border: InputBorder.none,
                isDense: true,
                contentPadding: EdgeInsets.symmetric(
                  vertical: 12,
                ),
              ),
            ),
          ),
          const SizedBox(height: 12),
          SizedBox(
            height: 38,
            child: ListView(
              scrollDirection: Axis.horizontal,
              children: [
                ..._dateFilters.map((label) {
                  final selected = _selectedDate == null &&
                      _selectedFilter == label;

                  return Padding(
                    padding: const EdgeInsets.only(right: 8),
                    child: _buildFilterChip(
                      label: selected
                          ? '$label${label == 'Hari Ini' ? ' ($todayCount)' : ''}'
                          : label,
                      selected: selected,
                      onTap: () => _selectDateFilter(label),
                    ),
                  );
                }),
                _buildFilterChip(
                  label: _selectedDate == null
                      ? 'Pilih Tanggal'
                      : '${_selectedDate!.day.toString().padLeft(2, '0')}/${_selectedDate!.month.toString().padLeft(2, '0')}/${_selectedDate!.year}',
                  selected: _selectedDate != null,
                  icon: Icons.calendar_today_outlined,
                  onTap: _pickDate,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildFilterChip({
    required String label,
    required bool selected,
    required VoidCallback onTap,
    IconData? icon,
  }) {
    return Material(
      color: selected
          ? _HistoryColors.accentBg
          : _HistoryColors.background,
      borderRadius: BorderRadius.circular(20),
      child: InkWell(
        borderRadius: BorderRadius.circular(20),
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(
            horizontal: 16,
            vertical: 8,
          ),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(20),
            border: Border.all(
              color: selected
                  ? _HistoryColors.accentBorder
                  : _HistoryColors.cardBorder,
            ),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (icon != null) ...[
                Icon(
                  icon,
                  size: 15,
                  color: selected
                      ? _HistoryColors.accentText
                      : _HistoryColors.textMuted,
                ),
                const SizedBox(width: 6),
              ],
              Text(
                label,
                style: TextStyle(
                  color: selected
                      ? _HistoryColors.accentText
                      : _HistoryColors.textBody,
                  fontSize: 13,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildSummaryCard({
    required int totalOmzet,
    required int totalTransaksi,
    required int qrisTotal,
    required int qrisCount,
    required int qrisPercent,
    required int tunaiTotal,
    required int tunaiCount,
    required int tunaiPercent,
  }) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: _HistoryColors.cardBorder),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.03),
            blurRadius: 8,
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
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'TOTAL OMZET HARI INI',
                      style: TextStyle(
                        color: _HistoryColors.textMuted,
                        fontSize: 12,
                        fontWeight: FontWeight.w700,
                        letterSpacing: 0.3,
                      ),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      _formatRupiah(totalOmzet),
                      style: const TextStyle(
                        color: _HistoryColors.textDark,
                        fontSize: 26,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ],
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 12,
                  vertical: 8,
                ),
                decoration: BoxDecoration(
                  color: _HistoryColors.accentBg,
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(
                    color: _HistoryColors.accentBorder,
                  ),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(
                      Icons.circle,
                      color: _HistoryColors.accentText,
                      size: 8,
                    ),
                    const SizedBox(width: 6),
                    Text(
                      '$totalTransaksi Transaksi',
                      style: const TextStyle(
                        color: _HistoryColors.accentText,
                        fontSize: 12.5,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          const Divider(
            height: 1,
            color: _HistoryColors.cardBorder,
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(
                child: _buildPaymentTile(
                  icon: Icons.credit_card_rounded,
                  iconColor: _HistoryColors.accentText,
                  label: 'QRIS ($qrisPercent%)',
                  amount: qrisTotal,
                  caption: '$qrisCount Pembayaran',
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: _buildPaymentTile(
                  icon: Icons.access_time_rounded,
                  iconColor: _HistoryColors.orangeText,
                  label: 'Tunai / Cash ($tunaiPercent%)',
                  amount: tunaiTotal,
                  caption: '$tunaiCount Transaksi',
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildPaymentTile({
    required IconData icon,
    required Color iconColor,
    required String label,
    required int amount,
    required String caption,
  }) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: _HistoryColors.background,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: _HistoryColors.cardBorder),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(
                icon,
                size: 15,
                color: iconColor,
              ),
              const SizedBox(width: 6),
              Expanded(
                child: Text(
                  label,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    color: _HistoryColors.textMuted,
                    fontSize: 12.5,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            _formatRupiah(amount),
            style: const TextStyle(
              color: _HistoryColors.textDark,
              fontSize: 16,
              fontWeight: FontWeight.w800,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            caption,
            style: const TextStyle(
              color: _HistoryColors.textHint,
              fontSize: 11.5,
              fontWeight: FontWeight.w500,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildDayHeader(DayGroup group) {
    return Row(
      children: [
        Container(
          width: 4,
          height: 16,
          decoration: BoxDecoration(
            color: group.isToday
                ? _HistoryColors.primary
                : _HistoryColors.textHint,
            borderRadius: BorderRadius.circular(2),
          ),
        ),
        const SizedBox(width: 8),
        Expanded(
          child: Text(
            group.label,
            style: const TextStyle(
              color: _HistoryColors.textDark,
              fontSize: 15,
              fontWeight: FontWeight.w700,
            ),
          ),
        ),
        Container(
          padding: const EdgeInsets.symmetric(
            horizontal: 10,
            vertical: 5,
          ),
          decoration: BoxDecoration(
            color: group.isToday
                ? _HistoryColors.accentBg
                : _HistoryColors.cardBorder.withValues(alpha: 0.6),
            borderRadius: BorderRadius.circular(16),
          ),
          child: Text(
            group.isToday || group.totalOmzet == null
                ? '${group.transactionCount} Pesanan'
                : '${group.transactionCount} Transaksi • ${_formatRupiah(group.totalOmzet!)}',
            style: TextStyle(
              color: group.isToday
                  ? _HistoryColors.accentText
                  : _HistoryColors.textBody,
              fontSize: 11.5,
              fontWeight: FontWeight.w700,
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildOrderList(DayGroup group) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: _HistoryColors.cardBorder),
      ),
      child: Column(
        children: [
          for (var i = 0; i < group.orders.length; i++) ...[
            _buildOrderRow(
              group.orders[i],
              group.isToday,
            ),
            if (i != group.orders.length - 1)
              const Divider(
                height: 1,
                color: _HistoryColors.cardBorder,
              ),
          ],
        ],
      ),
    );
  }

  Widget _buildOrderRow(
    OrderRecord order,
    bool isToday,
  ) {
    return InkWell(
      onTap: () {},
      child: Padding(
        padding: const EdgeInsets.symmetric(
          horizontal: 14,
          vertical: 12,
        ),
        child: Row(
          children: [
            Container(
              width: 58,
              height: 40,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: isToday
                    ? _HistoryColors.accentBg
                    : _HistoryColors.background,
                borderRadius: BorderRadius.circular(10),
                border: Border.all(
                  color: isToday
                      ? _HistoryColors.accentBorder
                      : _HistoryColors.cardBorder,
                ),
              ),
              child: Text(
                order.orderNo,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  color: isToday
                      ? _HistoryColors.accentText
                      : _HistoryColors.textBody,
                  fontSize: 11.5,
                  fontWeight: FontWeight.w800,
                ),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    order.itemsSummary,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      color: _HistoryColors.textDark,
                      fontSize: 14,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const SizedBox(height: 3),
                  Row(
                    children: [
                      Text(
                        order.time,
                        style: const TextStyle(
                          color: _HistoryColors.textHint,
                          fontSize: 12,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                      const Text(
                        ' • ',
                        style: TextStyle(
                          color: _HistoryColors.textHint,
                          fontSize: 12,
                        ),
                      ),
                      if (order.paymentSuccess)
                        const Icon(
                          Icons.check_circle,
                          color: _HistoryColors.accentText,
                          size: 13,
                        ),
                      if (order.paymentSuccess)
                        const SizedBox(width: 3),
                      Flexible(
                        child: Text(
                          order.paymentLabel,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            color: order.paymentSuccess
                                ? _HistoryColors.accentText
                                : _HistoryColors.textMuted,
                            fontSize: 12,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(width: 8),
            Text(
              _formatRupiah(order.total),
              style: const TextStyle(
                color: _HistoryColors.textDark,
                fontSize: 14,
                fontWeight: FontWeight.w800,
              ),
            ),
            const SizedBox(width: 4),
            const Icon(
              Icons.chevron_right_rounded,
              color: _HistoryColors.textHint,
              size: 20,
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildDownloadButton() {
    return OutlinedButton.icon(
      onPressed: () {},
      style: OutlinedButton.styleFrom(
        minimumSize: const Size(double.infinity, 50),
        foregroundColor: _HistoryColors.primaryDark,
        side: const BorderSide(
          color: _HistoryColors.cardBorder,
        ),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(14),
        ),
      ),
      icon: const Icon(
        Icons.download_rounded,
        size: 18,
      ),
      label: const Text(
        'Unduh Laporan Rekap Shift (CSV)',
        style: TextStyle(
          fontSize: 14,
          fontWeight: FontWeight.w700,
        ),
      ),
    );
  }

  Widget _buildEmptyState() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(
              Icons.receipt_long_outlined,
              size: 46,
              color: _HistoryColors.textHint,
            ),
            const SizedBox(height: 12),
            const Text(
              'Transaksi tidak ditemukan',
              style: TextStyle(
                color: _HistoryColors.textDark,
                fontSize: 16,
                fontWeight: FontWeight.w700,
              ),
            ),
            const SizedBox(height: 4),
            const Text(
              'Coba kata kunci lain atau ubah rentang tanggal.',
              textAlign: TextAlign.center,
              style: TextStyle(
                color: _HistoryColors.textMuted,
                fontSize: 13,
              ),
            ),
          ],
        ),
      ),
    );
  }
}