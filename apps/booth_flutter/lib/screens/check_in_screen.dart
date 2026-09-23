import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../api_client.dart';
import '../app_state.dart';
import '../theme.dart';

/// Absen Berangkat — wajib sebelum masuk MainShell. Booth default diambil
/// dari BoothShiftAssignment staff (lihat AppState.getMyAssignment), staff
/// boleh ganti manual lewat daftar Booth (AppState.getBooths).
class CheckInScreen extends StatefulWidget {
  const CheckInScreen({super.key});

  @override
  State<CheckInScreen> createState() => _CheckInScreenState();
}

class _CheckInScreenState extends State<CheckInScreen> {
  bool _loadingAssignment = true;
  bool _submitting = false;
  String? _errorText;

  Map<String, dynamic>? _assignment;
  List<dynamic> _booths = [];
  String? _selectedBoothId;
  String? _selectedBoothName;

  @override
  void initState() {
    super.initState();
    _loadAssignment();
  }

  Future<void> _loadAssignment() async {
    setState(() {
      _loadingAssignment = true;
      _errorText = null;
    });
    try {
      final assignment = await context.read<AppState>().getMyAssignment();
      setState(() {
        _assignment = assignment;
        if (assignment != null) {
          final booth = assignment['booth'] as Map<String, dynamic>;
          _selectedBoothId = booth['id'] as String;
          _selectedBoothName = booth['name'] as String;
        }
      });
    } on ApiException catch (e) {
      setState(() => _errorText = e.message);
    } finally {
      if (mounted) setState(() => _loadingAssignment = false);
    }
  }

  Future<void> _openBoothPicker() async {
    if (_booths.isEmpty) {
      try {
        _booths = await context.read<AppState>().getBooths();
      } on ApiException catch (e) {
        if (!mounted) return;
        setState(() => _errorText = e.message);
        return;
      }
    }
    if (!mounted) return;

    final selected = await showModalBottomSheet<Map<String, dynamic>>(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (context) => SafeArea(
        child: ListView(
          shrinkWrap: true,
          children: [
            const Padding(
              padding: EdgeInsets.all(16),
              child: Text(
                'Pilih Booth',
                style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
              ),
            ),
            for (final raw in _booths)
              ListTile(
                title: Text((raw as Map<String, dynamic>)['name'] as String),
                subtitle: Text(raw['code'] as String),
                onTap: () => Navigator.pop(context, raw),
              ),
          ],
        ),
      ),
    );

    if (selected != null) {
      setState(() {
        _selectedBoothId = selected['id'] as String;
        _selectedBoothName = selected['name'] as String;
      });
    }
  }

  Future<void> _submit() async {
    setState(() {
      _submitting = true;
      _errorText = null;
    });
    try {
      final defaultBoothId = _assignment != null
          ? (_assignment!['booth'] as Map<String, dynamic>)['id'] as String
          : null;
      final override = _selectedBoothId != defaultBoothId
          ? _selectedBoothId
          : null;
      // GPS/foto capture di-skip sementara, lihat catatan di AppState.checkIn().
      await context.read<AppState>().checkIn(boothId: override);
      if (!mounted) return;
      Navigator.pushReplacementNamed(context, '/home');
    } on ApiException catch (e) {
      setState(() => _errorText = e.message);
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final staffName = context.watch<AppState>().staffName;

    return Scaffold(
      backgroundColor: ObbelTheme.backgroundLight,
      appBar: AppBar(title: const Text('Absen Berangkat')),
      body: SafeArea(
        child: SingleChildScrollView(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: _loadingAssignment
                ? const Center(child: CircularProgressIndicator())
                : Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Text(
                        'Halo, $staffName',
                        style: const TextStyle(
                          color: ObbelTheme.textDark,
                          fontWeight: FontWeight.w800,
                          fontSize: 20,
                        ),
                      ),
                      const SizedBox(height: 8),
                      const Text(
                        'Konfirmasi Booth tempat Anda bertugas hari ini sebelum mulai.',
                        style: TextStyle(
                          color: ObbelTheme.textLight,
                          fontSize: 13,
                        ),
                      ),
                      const SizedBox(height: 24),
                      if (_assignment == null) ...[
                        Container(
                          padding: const EdgeInsets.all(16),
                          decoration: BoxDecoration(
                            color: ObbelTheme.accentRed.withValues(alpha: 0.08),
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: const Text(
                            'Anda belum ditugaskan ke Booth manapun. Hubungi Admin untuk mengatur penugasan Booth/Shift Anda.',
                            style: TextStyle(
                              color: ObbelTheme.accentRed,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ),
                        const SizedBox(height: 12),
                        OutlinedButton(
                          onPressed: _loadingAssignment
                              ? null
                              : _loadAssignment,
                          child: const Text('Coba Lagi'),
                        ),
                      ] else ...[
                        Container(
                          padding: const EdgeInsets.all(16),
                          decoration: BoxDecoration(
                            color: ObbelTheme.white,
                            borderRadius: BorderRadius.circular(16),
                            border: Border.all(color: Colors.grey.shade200),
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Text(
                                'BOOTH',
                                style: TextStyle(
                                  color: ObbelTheme.textLight,
                                  fontSize: 11,
                                  fontWeight: FontWeight.bold,
                                  letterSpacing: 0.5,
                                ),
                              ),
                              const SizedBox(height: 4),
                              Text(
                                _selectedBoothName ?? '-',
                                style: const TextStyle(
                                  color: ObbelTheme.textDark,
                                  fontSize: 18,
                                  fontWeight: FontWeight.w800,
                                ),
                              ),
                              const SizedBox(height: 12),
                              const Text(
                                'SHIFT',
                                style: TextStyle(
                                  color: ObbelTheme.textLight,
                                  fontSize: 11,
                                  fontWeight: FontWeight.bold,
                                  letterSpacing: 0.5,
                                ),
                              ),
                              const SizedBox(height: 4),
                              Text(
                                (_assignment!['shiftTemplate'] as Map)['name']
                                    as String,
                                style: const TextStyle(
                                  color: ObbelTheme.textDark,
                                  fontSize: 16,
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                              const SizedBox(height: 12),
                              Align(
                                alignment: Alignment.centerLeft,
                                child: TextButton(
                                  onPressed: _openBoothPicker,
                                  child: const Text('Ganti Booth'),
                                ),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(height: 24),
                        if (_errorText != null) ...[
                          Text(
                            _errorText!,
                            style: const TextStyle(
                              color: ObbelTheme.accentRed,
                              fontWeight: FontWeight.w600,
                              fontSize: 13,
                            ),
                          ),
                          const SizedBox(height: 12),
                        ],
                        ElevatedButton(
                          onPressed: _submitting ? null : _submit,
                          child: _submitting
                              ? const SizedBox(
                                  width: 22,
                                  height: 22,
                                  child: CircularProgressIndicator(
                                    color: Colors.white,
                                    strokeWidth: 2.5,
                                  ),
                                )
                              : const Text('CHECK IN'),
                        ),
                      ],
                    ],
                  ),
          ),
        ),
      ),
    );
  }
}
