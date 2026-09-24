import 'package:flutter/material.dart';
import 'screens/pwa_shell_screen.dart';
import 'theme.dart';

void main() {
  runApp(const ObbelBoothApp());
}

class ObbelBoothApp extends StatelessWidget {
  const ObbelBoothApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Obbel Petugas Booth',
      theme: ObbelTheme.lightTheme,
      debugShowCheckedModeBanner: false,
      home: const PwaShellScreen(),
    );
  }
}
