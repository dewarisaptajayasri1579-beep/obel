import 'package:flutter/material.dart';

import '../obbel_icons.dart';
import '../theme.dart';
import 'booth_ranking_screen.dart';
import 'executive_home_screen.dart';
import 'laporan_screen.dart';
import 'penjualan_screen.dart';

class MainShell extends StatefulWidget {
  const MainShell({super.key});

  @override
  State<MainShell> createState() => _MainShellState();
}

class _MainShellState extends State<MainShell> {
  int _currentIndex = 0;

  final List<Widget> _screens = const [
    ExecutiveHomeScreen(),
    BoothRankingScreen(),
    PenjualanScreen(),
    LaporanScreen(),
  ];

  static const _labels = ['Beranda', 'Booth', 'Penjualan', 'Laporan'];
  static const _icons = ['home', 'box_closed', 'register', 'document'];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: IndexedStack(index: _currentIndex, children: _screens),
      bottomNavigationBar: Container(
        decoration: BoxDecoration(
          boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.05), blurRadius: 15, offset: const Offset(0, -4))],
        ),
        child: BottomNavigationBar(
          currentIndex: _currentIndex,
          onTap: (index) => setState(() => _currentIndex = index),
          type: BottomNavigationBarType.fixed,
          selectedItemColor: ObbelTheme.primaryDark,
          unselectedItemColor: const Color(0xFF8D9690),
          backgroundColor: Colors.white,
          elevation: 0,
          selectedLabelStyle: const TextStyle(fontFamily: 'Outfit', fontWeight: FontWeight.bold, fontSize: 12),
          unselectedLabelStyle: const TextStyle(fontFamily: 'Outfit', fontWeight: FontWeight.w500, fontSize: 12),
          items: List.generate(_labels.length, (i) {
            return BottomNavigationBarItem(
              icon: Padding(
                padding: const EdgeInsets.only(bottom: 4),
                child: CustomPaint(size: const Size(22, 22), painter: ObbelIconPainter(iconType: _icons[i], color: const Color(0xFF8D9690))),
              ),
              activeIcon: Padding(
                padding: const EdgeInsets.only(bottom: 4),
                child: CustomPaint(size: const Size(22, 22), painter: ObbelIconPainter(iconType: _icons[i], color: ObbelTheme.primaryDark)),
              ),
              label: _labels[i],
            );
          }),
        ),
      ),
    );
  }
}
