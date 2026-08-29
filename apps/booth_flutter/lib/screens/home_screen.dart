import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../app_state.dart';
import '../obbel_icons.dart';
import '../theme.dart';

class HomeScreen extends StatelessWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final appState = context.watch<AppState>();
    return Scaffold(
      backgroundColor: ObbelTheme.backgroundLight,
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        toolbarHeight: 65,
        title: Row(
          children: [
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Selamat pagi,',
                  style: TextStyle(
                    fontSize: 13,
                    color: ObbelTheme.textLight,
                    fontWeight: FontWeight.w500,
                  ),
                ),
                Text(
                  '${appState.staffName} 👋',
                  style: const TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.bold,
                    color: ObbelTheme.textDark,
                  ),
                ),
              ],
            ),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.notifications_outlined, color: ObbelTheme.textDark),
            onPressed: () {},
          ),
        ],
      ),
      body: SingleChildScrollView(
        child: Padding(
          padding: const EdgeInsets.all(16.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Active Shift Information Card
              Container(
                width: double.infinity,
                padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 18),
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(16),
                  image: const DecorationImage(
                    image: AssetImage('assets/images/back-img.png'),
                    fit: BoxFit.cover,
                  ),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      appState.boothName,
                      style: const TextStyle(
                        fontFamily: 'Outfit',
                        color: Colors.white,
                        fontSize: 16,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    const SizedBox(height: 12),
                    Text(
                      appState.shiftLabel,
                      style: const TextStyle(
                        fontFamily: 'Outfit',
                        color: Colors.white,
                        fontSize: 24,
                        fontWeight: FontWeight.w900,
                        letterSpacing: 0.5,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      appState.shiftTime,
                      style: const TextStyle(
                        fontFamily: 'Outfit',
                        color: Color(0xCCFFFFFF), // 80% opacity white
                        fontSize: 16,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 16),

              // Orange action banner for incoming stock
              if (appState.pendingInbound != null)
              Container(
                width: double.infinity,
                padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 20),
                decoration: BoxDecoration(
                  color: const Color(0xFFFFF9F5), // Background cream-orange hangat
                  borderRadius: BorderRadius.circular(18),
                  border: Border.all(
                    color: const Color(0xFFFFDEC9), // Border oranye hangat
                    width: 1.5,
                  ),
                  boxShadow: [
                    BoxShadow(
                      color: ObbelTheme.accentOrange.withOpacity(0.04),
                      blurRadius: 12,
                      offset: const Offset(0, 6),
                    ),
                  ],
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        // Orange Box Icon with Pulse Decoration
                        Container(
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(
                            color: Colors.white,
                            shape: BoxShape.circle,
                            boxShadow: [
                              BoxShadow(
                                color: ObbelTheme.accentOrange.withOpacity(0.12),
                                blurRadius: 8,
                                spreadRadius: 1,
                              ),
                            ],
                          ),
                          child: CustomPaint(
                            size: const Size(28, 28),
                            painter: ObbelIconPainter(
                              iconType: 'box_open',
                              color: ObbelTheme.accentOrange,
                            ),
                          ),
                        ),
                        const SizedBox(width: 16),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                children: [
                                  const Text(
                                    'Ada stok masuk',
                                    style: TextStyle(
                                      fontFamily: 'Outfit',
                                      fontSize: 18,
                                      fontWeight: FontWeight.w900,
                                      color: ObbelTheme.textDark,
                                    ),
                                  ),
                                  // 'PENTING' Badge tag
                                  Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                                    decoration: BoxDecoration(
                                      color: ObbelTheme.accentOrange,
                                      borderRadius: BorderRadius.circular(8),
                                    ),
                                    child: const Text(
                                      'PENTING',
                                      style: TextStyle(
                                        fontFamily: 'Outfit',
                                        fontSize: 10,
                                        fontWeight: FontWeight.w900,
                                        color: Colors.white,
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                              const Text(
                                'untuk Shift 1',
                                style: TextStyle(
                                  fontFamily: 'Outfit',
                                  fontSize: 18,
                                  fontWeight: FontWeight.w900,
                                  color: ObbelTheme.textDark,
                                  height: 1.1,
                                ),
                              ),
                              const SizedBox(height: 8),
                              const Text(
                                'Silakan periksa & terima stok untuk memulai penjualan.',
                                style: TextStyle(
                                  fontSize: 13,
                                  color: ObbelTheme.textLight,
                                  fontWeight: FontWeight.w600,
                                  height: 1.35,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 20),
                    SizedBox(
                      width: double.infinity,
                      child: ElevatedButton(
                        style: ElevatedButton.styleFrom(
                          backgroundColor: ObbelTheme.accentOrange,
                          padding: const EdgeInsets.symmetric(vertical: 16),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(12),
                          ),
                          elevation: 0,
                        ),
                        onPressed: () {
                          Navigator.pushNamed(context, '/inbound');
                        },
                        child: const Text(
                          'Lihat & Terima Stok',
                          style: TextStyle(
                            fontFamily: 'Outfit',
                            fontWeight: FontWeight.bold,
                            fontSize: 15,
                            color: Colors.white,
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 24),

              // Summary Section Header
              const Text(
                'Kinerja Booth Hari Ini',
                style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w800,
                  color: ObbelTheme.textDark,
                ),
              ),
              const SizedBox(height: 14),

              // Grid items for key metrics
              GridView.count(
                crossAxisCount: 2,
                crossAxisSpacing: 12,
                mainAxisSpacing: 12,
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                childAspectRatio: 1.20, // Menambah ruang vertikal kartu agar tidak terjadi bottom overlay/overflow
                children: [
                  _buildMetricCard(
                    title: 'Penjualan Hari Ini',
                    value: 'Rp ${appState.omzetToday}',
                    iconName: 'home',
                    valueFontSize: 20, // Khusus penjualan dibatasi ke 20 agar pas tidak overflow
                    extraWidget: Padding(
                      padding: const EdgeInsets.only(top: 2.0),
                      child: CustomPaint(
                        size: const Size(double.infinity, 16),
                        painter: SparklinePainter(),
                      ),
                    ),
                  ),
                  _buildMetricCard(
                    title: 'Cup Terjual',
                    value: '${appState.cupSoldToday} cup',
                    iconName: 'document_code',
                  ),
                  _buildMetricCard(
                    title: 'Stok Alert',
                    value: '${appState.lowStockCount} item',
                    iconName: 'warning',
                    isWarning: appState.lowStockCount > 0,
                  ),
                  _buildMetricCard(
                    title: 'Transaksi',
                    value: '${appState.transactionCount}',
                    iconName: 'document',
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildMetricCard({
    required String title,
    required String value,
    required String iconName,
    Widget? extraWidget,
    bool isWarning = false,
    double? valueFontSize,
  }) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: isWarning
              ? ObbelTheme.accentOrange.withOpacity(0.3)
              : Colors.grey.shade200,
          width: 1.2,
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.02),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: const TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.bold,
              color: ObbelTheme.textLight,
            ),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
          Expanded(
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Text(
                        value,
                        style: TextStyle(
                          fontFamily: 'Outfit',
                          fontSize: valueFontSize ?? 26, // Dinamis menggunakan ukuran kustom jika ada
                          fontWeight: FontWeight.w900,
                          color: isWarning ? ObbelTheme.accentOrange : ObbelTheme.textDark,
                        ),
                      ),
                      if (extraWidget != null) ...[
                        const SizedBox(height: 4),
                        extraWidget,
                      ],
                    ],
                  ),
                ),
                const SizedBox(width: 4),
                CustomPaint(
                  size: const Size(32, 32),
                  painter: ObbelIconPainter(
                    iconType: iconName,
                    color: isWarning ? ObbelTheme.accentOrange : const Color(0xFFC4C9C6),
                  ),
                ),
              ],
            ),
          )
        ],
      ),
    );
  }
}

class SparklinePainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = const Color(0xFF0E6F3F) // Warna hijau Obbel untuk grafik
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2.0
      ..strokeCap = StrokeCap.round;

    final path = Path();
    // Gambar garis grafik bergelombang naik secara manual matching mockup #2
    path.moveTo(0, size.height * 0.7);
    path.lineTo(size.width * 0.15, size.height * 0.65);
    path.lineTo(size.width * 0.3, size.height * 0.75);
    path.lineTo(size.width * 0.45, size.height * 0.68);
    path.lineTo(size.width * 0.6, size.height * 0.72);
    path.lineTo(size.width * 0.75, size.height * 0.58);
    path.lineTo(size.width * 0.9, size.height * 0.62);
    path.lineTo(size.width, size.height * 0.3); // Grafik melonjak naik di ujung

    canvas.drawPath(path, paint);
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
