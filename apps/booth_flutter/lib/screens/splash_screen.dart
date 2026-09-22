import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../app_state.dart';
import '../theme.dart';

/// Layar transisi saat app baru dibuka — mencoba pulihkan sesi login dari
/// token tersimpan lokal sebelum memutuskan tujuan awal (/home atau
/// /login), supaya Petugas tidak perlu login ulang tiap app di-restart.
class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _bootstrap());
  }

  Future<void> _bootstrap() async {
    final restored = await context.read<AppState>().restoreSession();
    if (!mounted) return;
    Navigator.of(context).pushReplacementNamed(restored ? '/home' : '/login');
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: ObbelTheme.primaryDark,
      body: const Center(
        child: CircularProgressIndicator(color: Colors.white),
      ),
    );
  }
}
