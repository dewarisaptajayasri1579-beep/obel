import 'dart:async';
import 'dart:convert';

import 'package:flutter_foreground_task/flutter_foreground_task.dart';
import 'package:geolocator/geolocator.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

const prefApiBaseUrl = 'obel_gps_api_base_url';
const prefAuthToken = 'obel_gps_auth_token';
const prefShiftId = 'obel_gps_shift_id';
const prefLocationPath = 'obel_gps_location_path';

/// Jalan di isolate terpisah milik foreground service Android — TIDAK
/// terikat lifecycle WebView/JS sama sekali. Ini yang bikin GPS tetap
/// terkirim walau layar HP terkunci: Android boleh membekukan activity,
/// tapi foreground service (dengan notifikasi persisten) tetap dikasih
/// jatah CPU oleh OS.
///
/// Konfigurasi (base URL, token, shiftId) dibaca dari SharedPreferences
/// karena isolate ini tidak bisa mengakses variabel statis di isolate UI —
/// [LocationBridgeService.start] menyimpannya sebelum memulai service.
class LocationTaskHandler extends TaskHandler {
  @override
  Future<void> onStart(DateTime timestamp, TaskStarter starter) async {
    await _sendPing();
  }

  @override
  Future<void> onRepeatEvent(DateTime timestamp) async {
    await _sendPing();
  }

  @override
  Future<void> onDestroy(DateTime timestamp, bool isTimeout) async {}

  Future<void> _sendPing() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final apiBaseUrl = prefs.getString(prefApiBaseUrl);
      final token = prefs.getString(prefAuthToken);
      final shiftId = prefs.getString(prefShiftId);
      final path = prefs.getString(prefLocationPath) ?? 'shifts/{shiftId}/location-ping';
      if (apiBaseUrl == null || token == null || shiftId == null) return;

      final position = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(accuracy: LocationAccuracy.high),
      );

      final url = Uri.parse('$apiBaseUrl/${path.replaceAll('{shiftId}', shiftId)}');
      final response = await http.post(
        url,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $token',
        },
        body: jsonEncode({
          'latitude': position.latitude,
          'longitude': position.longitude,
          'capturedAt': DateTime.now().toUtc().toIso8601String(),
        }),
      );

      FlutterForegroundTask.updateService(
        notificationTitle: 'Obbel — lokasi aktif',
        notificationText: response.statusCode < 300
            ? 'Terkirim ${_formatJam(DateTime.now())}'
            : 'Gagal kirim (${response.statusCode}), coba lagi menit depan',
      );
    } catch (_) {
      // Ping berikutnya jalan otomatis di interval selanjutnya — tidak perlu
      // retry manual di sini, cukup biarkan notifikasi menunjukkan status
      // terakhir supaya petugas tahu kalau ada masalah koneksi/GPS.
      FlutterForegroundTask.updateService(
        notificationTitle: 'Obbel — lokasi aktif',
        notificationText: 'Gagal ambil lokasi, coba lagi menit depan',
      );
    }
  }

  String _formatJam(DateTime dt) {
    final local = dt.toLocal();
    String two(int n) => n.toString().padLeft(2, '0');
    return '${two(local.hour)}:${two(local.minute)}';
  }
}
