import 'package:flutter/material.dart';
import 'home_screen.dart';
import 'pos_screen.dart';
import 'stock_screen.dart';
import 'shift_screen.dart';
import '../obbel_icons.dart';
import '../theme.dart';

class MainShell extends StatefulWidget {
  const MainShell({super.key});

  @override
  State<MainShell> createState() => _MainShellState();
}


class _MainShellState extends State<MainShell> {
  int _currentIndex = 0;

  final List<Widget> _screens = [
    const HomeScreen(),
    const PosScreen(),
    const StockScreen(),
    const ShiftScreen(),
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: IndexedStack(
        index: _currentIndex,
        children: _screens,
      ),
      bottomNavigationBar: Container(
        decoration: BoxDecoration(
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.05),
              blurRadius: 15,
              offset: const Offset(0, -4),
            ),
          ],
        ),
        child: BottomNavigationBar(
          currentIndex: _currentIndex,
          onTap: (index) {
            setState(() {
              _currentIndex = index;
            });
          },
          type: BottomNavigationBarType.fixed,
          selectedItemColor: const Color(0xFF0E6F3F),
          unselectedItemColor: const Color(0xFF8D9690),
          backgroundColor: Colors.white,
          elevation: 0,
          selectedLabelStyle: const TextStyle(
            fontFamily: 'Outfit',
            fontWeight: FontWeight.bold,
            fontSize: 12,
            letterSpacing: 0.2,
          ),
          unselectedLabelStyle: const TextStyle(
            fontFamily: 'Outfit',
            fontWeight: FontWeight.w500,
            fontSize: 12,
            letterSpacing: 0.2,
          ),
          items: [
            BottomNavigationBarItem(
              icon: Padding(
                padding: const EdgeInsets.only(bottom: 4),
                child: CustomPaint(
                  size: const Size(22, 22),
                  painter: ObbelIconPainter(iconType: 'home', color: const Color(0xFF8D9690)),
                ),
              ),
              activeIcon: Padding(
                padding: const EdgeInsets.only(bottom: 4),
                child: CustomPaint(
                  size: const Size(22, 22),
                  painter: ObbelIconPainter(iconType: 'home', color: const Color(0xFF0E6F3F)),
                ),
              ),
              label: 'Beranda',
            ),
            BottomNavigationBarItem(
              icon: Padding(
                padding: const EdgeInsets.only(bottom: 4),
                child: CustomPaint(
                  size: const Size(22, 22),
                  painter: ObbelIconPainter(iconType: 'register', color: const Color(0xFF8D9690)),
                ),
              ),
              activeIcon: Padding(
                padding: const EdgeInsets.only(bottom: 4),
                child: CustomPaint(
                  size: const Size(22, 22),
                  painter: ObbelIconPainter(iconType: 'register', color: const Color(0xFF0E6F3F)),
                ),
              ),
              label: 'Jual / POS',
            ),
            BottomNavigationBarItem(
              icon: Padding(
                padding: const EdgeInsets.only(bottom: 4),
                child: CustomPaint(
                  size: const Size(22, 22),
                  painter: ObbelIconPainter(iconType: 'box_closed', color: const Color(0xFF8D9690)),
                ),
              ),
              activeIcon: Padding(
                padding: const EdgeInsets.only(bottom: 4),
                child: CustomPaint(
                  size: const Size(22, 22),
                  painter: ObbelIconPainter(iconType: 'box_closed', color: const Color(0xFF0E6F3F)),
                ),
              ),
              label: 'Stok',
            ),
            BottomNavigationBarItem(
              icon: Padding(
                padding: const EdgeInsets.only(bottom: 4),
                child: CustomPaint(
                  size: const Size(22, 22),
                  painter: ObbelIconPainter(iconType: 'badge', color: const Color(0xFF8D9690)),
                ),
              ),
              activeIcon: Padding(
                padding: const EdgeInsets.only(bottom: 4),
                child: CustomPaint(
                  size: const Size(22, 22),
                  painter: ObbelIconPainter(iconType: 'badge', color: const Color(0xFF0E6F3F)),
                ),
              ),
              label: 'Shift',
            ),
          ],
        ),
      ),
    );
  }
}
