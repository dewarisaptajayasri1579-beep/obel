import 'package:geolocator/geolocator.dart';

/// Minta izin & ambil posisi GPS saat ini. Dipakai oleh
/// PwaShellScreen.onGeolocationPermissionsShowPrompt sebagai syarat OS-level
/// sebelum WebView diizinkan pakai navigator.geolocation milik PWA — server
/// cuma memakai lokasi ini sebagai peringatan non-blocking jarak ke Booth
/// (lihat ShiftsService.computeLocationWarning di backend).
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
