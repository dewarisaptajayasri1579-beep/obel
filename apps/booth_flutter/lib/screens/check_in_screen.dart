import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../api_client.dart';
import '../app_state.dart';
import '../theme.dart';

/// Ditampilkan saat Petugas sudah login (token/profil valid) tapi belum
/// punya ShiftSession aktif hari ini — mengganti dead-end lama di mana
/// login gagal total kalau belum ada shift (lihat AppState._loadShiftAndCatalog).
class CheckInScreen extends StatefulWidget {
  const CheckInScreen({super.key});

  @override
  State<CheckInScreen> createState() => _CheckInScreenState();
}

class _CheckInScreenState extends State<CheckInScreen> {
  String? _errorText;

  Future<void> _checkIn() async {
    setState(() => _errorText = null);
    try {
      await context.read<AppState>().checkIn();
      if (!mounted) return;
      Navigator.pushReplacementNamed(context, '/home');
    } on ApiException catch (e) {
      setState(() => _errorText = e.message);
    }
  }

  @override
  Widget build(BuildContext context) {
    final appState = context.watch<AppState>();

    return Scaffold(
      backgroundColor: ObbelTheme.backgroundLight,
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Container(
                width: 80,
                height: 80,
                decoration: BoxDecoration(
                  color: ObbelTheme.primaryDark.withValues(alpha: 0.1),
                  shape: BoxShape.circle,
                ),
                child: const Icon(
                  Icons.badge_outlined,
                  color: ObbelTheme.primaryDark,
                  size: 40,
                ),
              ),
              const SizedBox(height: 24),
              Text(
                'Halo, ${appState.staffName.isNotEmpty ? appState.staffName : 'Petugas'} 👋',
                textAlign: TextAlign.center,
                style: const TextStyle(
                  fontSize: 20,
                  fontWeight: FontWeight.w800,
                  color: ObbelTheme.textDark,
                ),
              ),
              const SizedBox(height: 8),
              const Text(
                'Anda belum check-in untuk shift hari ini. '
                'Tekan tombol di bawah untuk mulai shift.',
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: 14,
                  color: ObbelTheme.textLight,
                ),
              ),
              const SizedBox(height: 28),
              if (_errorText != null) ...[
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: ObbelTheme.accentRed.withValues(alpha: 0.08),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Text(
                    _errorText!,
                    textAlign: TextAlign.center,
                    style: const TextStyle(
                      color: ObbelTheme.accentRed,
                      fontWeight: FontWeight.w600,
                      fontSize: 13,
                    ),
                  ),
                ),
                const SizedBox(height: 16),
              ],
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: appState.loading ? null : _checkIn,
                  child: appState.loading
                      ? const SizedBox(
                          width: 22,
                          height: 22,
                          child: CircularProgressIndicator(
                            color: Colors.white,
                            strokeWidth: 2.5,
                          ),
                        )
                      : const Text('ABSEN BERANGKAT / MULAI SHIFT'),
                ),
              ),
              const SizedBox(height: 12),
              TextButton(
                onPressed: appState.loading
                    ? null
                    : () {
                        appState.logout();
                        Navigator.pushReplacementNamed(context, '/login');
                      },
                child: const Text('Keluar'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
