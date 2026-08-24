import 'package:flutter/material.dart';

import '../../core/theme/app_colors.dart';
import '../home/home_screen.dart';
import '../pos/pos_screen.dart';
import '../shift/shift_screen.dart';
import '../stock/stock_screen.dart';

class RootShell extends StatefulWidget {
  const RootShell({super.key});

  @override
  State<RootShell> createState() => _RootShellState();
}

class _RootShellState extends State<RootShell> {
  int _index = 0;

  static const _screens = [
    HomeScreen(),
    PosScreen(),
    StockScreen(),
    ShiftScreen(),
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: IndexedStack(index: _index, children: _screens),
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: _index,
        onTap: (i) => setState(() => _index = i),
        selectedFontSize: 12,
        unselectedFontSize: 12,
        items: const [
          BottomNavigationBarItem(
            icon: Icon(Icons.home_rounded),
            label: 'Beranda',
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.point_of_sale_rounded),
            label: 'Jual / POS',
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.inventory_2_rounded),
            label: 'Stok',
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.assignment_rounded),
            label: 'Shift',
          ),
        ],
      ),
    );
  }
}

/// Warna badge notifikasi kecil di ikon nav, dipakai bila ada inbound/restock.
const navBadgeColor = AppColors.critical;
