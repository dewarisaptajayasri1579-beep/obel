import 'dart:io';

import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import 'package:image_picker/image_picker.dart';

import 'theme.dart';

class AttendanceCaptureResult {
  AttendanceCaptureResult({
    required this.latitude,
    required this.longitude,
    required this.photo,
  });

  final double latitude;
  final double longitude;
  final XFile photo;
}

/// Minta izin & ambil posisi GPS saat ini. Server hanya memakai ini sebagai
/// peringatan non-blocking jarak ke Booth (lihat
/// ShiftsService.computeLocationWarning) — bukan hard block.
Future<Position> captureCurrentLocation() async {
  var permission = await Geolocator.checkPermission();
  if (permission == LocationPermission.denied) {
    permission = await Geolocator.requestPermission();
  }
  if (permission == LocationPermission.denied ||
      permission == LocationPermission.deniedForever) {
    throw StateError(
      'Izin lokasi ditolak. Aktifkan izin Lokasi untuk aplikasi ini di Setting HP.',
    );
  }

  if (!await Geolocator.isLocationServiceEnabled()) {
    throw StateError('GPS tidak aktif. Aktifkan Lokasi di HP lalu coba lagi.');
  }

  return Geolocator.getCurrentPosition(
    locationSettings: const LocationSettings(accuracy: LocationAccuracy.high),
  );
}

/// Panel Absen (GPS + foto selfie) yang dipakai bareng oleh Check-In dan
/// Check-Out — dua-duanya butuh capture yang identik (lihat
/// ShiftsService.checkIn/confirmClosing, ConfirmClosingDto).
class AttendanceCaptureCard extends StatefulWidget {
  const AttendanceCaptureCard({super.key, required this.onChanged});

  /// Dipanggil setiap kali status capture berubah — null berarti belum
  /// lengkap (lokasi dan/atau foto belum ada).
  final ValueChanged<AttendanceCaptureResult?> onChanged;

  @override
  State<AttendanceCaptureCard> createState() => AttendanceCaptureCardState();
}

class AttendanceCaptureCardState extends State<AttendanceCaptureCard> {
  Position? _position;
  XFile? _photo;
  bool _locating = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _captureLocation();
  }

  Future<void> _captureLocation() async {
    setState(() {
      _locating = true;
      _error = null;
    });
    try {
      final position = await captureCurrentLocation();
      if (!mounted) return;
      setState(() => _position = position);
      _notify();
    } catch (e) {
      if (!mounted) return;
      setState(
        () => _error = e is StateError ? e.message : 'Gagal mengambil lokasi.',
      );
    } finally {
      if (mounted) setState(() => _locating = false);
    }
  }

  Future<void> _capturePhoto() async {
    try {
      final photo = await ImagePicker().pickImage(
        source: ImageSource.camera,
        preferredCameraDevice: CameraDevice.front,
        // Kualitas rendah sengaja dipilih — ini cuma foto verifikasi
        // kehadiran, bukan foto produk; ukuran file kecil penting karena
        // di-upload lewat multipart yang jauh lebih sensitif ke WiFi
        // lambat/kongesti daripada request JSON biasa.
        imageQuality: 50,
        maxWidth: 720,
      );
      if (photo == null || !mounted) return;
      setState(() => _photo = photo);
      _notify();
    } catch (_) {
      if (!mounted) return;
      setState(
        () => _error = 'Gagal mengambil foto. Pastikan izin Kamera diaktifkan.',
      );
    }
  }

  void _notify() {
    final position = _position;
    final photo = _photo;
    if (position == null || photo == null) {
      widget.onChanged(null);
      return;
    }
    widget.onChanged(
      AttendanceCaptureResult(
        latitude: position.latitude,
        longitude: position.longitude,
        photo: photo,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Container(
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
            'LOKASI',
            style: TextStyle(
              color: ObbelTheme.textLight,
              fontSize: 11,
              fontWeight: FontWeight.bold,
              letterSpacing: 0.5,
            ),
          ),
          const SizedBox(height: 4),
          Row(
            children: [
              Expanded(
                child: Text(
                  _locating
                      ? 'Mengambil lokasi...'
                      : _position != null
                      ? '${_position!.latitude.toStringAsFixed(5)}, ${_position!.longitude.toStringAsFixed(5)} (akurat ${_position!.accuracy.round()}m)'
                      : 'Lokasi belum diambil',
                  style: const TextStyle(
                    color: ObbelTheme.textDark,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
              if (!_locating)
                TextButton(
                  onPressed: _captureLocation,
                  child: const Text('Ulangi'),
                ),
            ],
          ),
          const SizedBox(height: 16),
          const Text(
            'FOTO SELFIE',
            style: TextStyle(
              color: ObbelTheme.textLight,
              fontSize: 11,
              fontWeight: FontWeight.bold,
              letterSpacing: 0.5,
            ),
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              if (_photo != null)
                ClipRRect(
                  borderRadius: BorderRadius.circular(10),
                  child: Image.file(
                    File(_photo!.path),
                    width: 56,
                    height: 56,
                    fit: BoxFit.cover,
                  ),
                ),
              if (_photo != null) const SizedBox(width: 12),
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: _capturePhoto,
                  icon: const Icon(Icons.camera_alt_outlined, size: 18),
                  label: Text(_photo == null ? 'Ambil Foto' : 'Ambil Ulang'),
                ),
              ),
            ],
          ),
          if (_error != null) ...[
            const SizedBox(height: 12),
            Text(
              _error!,
              style: const TextStyle(
                color: ObbelTheme.accentRed,
                fontWeight: FontWeight.w600,
                fontSize: 13,
              ),
            ),
          ],
        ],
      ),
    );
  }
}
