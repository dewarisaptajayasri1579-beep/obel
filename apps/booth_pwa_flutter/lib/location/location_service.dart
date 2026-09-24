import 'package:flutter_foreground_task/flutter_foreground_task.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'location_task_handler.dart';

/// Entry point terpisah wajib dipanggil top-level (bukan method instance)
/// karena dijalankan Android di isolate baru milik foreground service.
@pragma('vm:entry-point')
void startLocationCallback() {
  FlutterForegroundTask.setTaskHandler(LocationTaskHandler());
}

/// Membungkus flutter_foreground_task supaya bridge tinggal panggil
/// start/stop tanpa tahu detail platform. Dipanggil dari WebBridge saat PWA
/// mengirim action `gps.start` (pas check-in sukses) / `gps.stop` (pas
/// check-out atau shift ditutup paksa).
class LocationBridgeService {
  LocationBridgeService._();
  static final instance = LocationBridgeService._();

  bool _initialized = false;

  void _ensureInit() {
    if (_initialized) return;
    FlutterForegroundTask.init(
      androidNotificationOptions: AndroidNotificationOptions(
        channelId: 'obel_location_channel',
        channelName: 'Obbel — Pelacakan Lokasi Booth',
        channelDescription: 'Notifikasi ini aktif selama shift berjalan supaya lokasi booth muncul di peta Admin.',
        onlyAlertOnce: true,
      ),
      iosNotificationOptions: const IOSNotificationOptions(),
      foregroundTaskOptions: ForegroundTaskOptions(
        eventAction: ForegroundTaskEventAction.repeat(60000), // 1 menit, sesuai kesepakatan
        autoRunOnBoot: false,
        allowWakeLock: true,
        allowWifiLock: false,
      ),
    );
    _initialized = true;
  }

  /// true kalau izin lengkap (lokasi + "izinkan selalu" + notifikasi Android 13+).
  Future<bool> requestPermissions() async {
    final whenInUse = await Permission.locationWhenInUse.request();
    if (!whenInUse.isGranted) return false;

    // ACCESS_BACKGROUND_LOCATION wajib diminta terpisah SETELAH foreground
    // location granted (aturan Android 10+) — ini yang bikin GPS boleh jalan
    // walau app tidak di layar depan.
    final always = await Permission.locationAlways.request();

    final notif = await Permission.notification.request();

    return always.isGranted && (notif.isGranted || notif.isLimited);
  }

  Future<bool> get isTracking async => FlutterForegroundTask.isRunningService;

  Future<bool> start({
    required String apiBaseUrl,
    required String authToken,
    required String shiftId,
    String locationPath = 'shifts/{shiftId}/location-ping',
  }) async {
    final granted = await requestPermissions();
    if (!granted) return false;

    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(prefApiBaseUrl, apiBaseUrl);
    await prefs.setString(prefAuthToken, authToken);
    await prefs.setString(prefShiftId, shiftId);
    await prefs.setString(prefLocationPath, locationPath);

    _ensureInit();

    if (await FlutterForegroundTask.isRunningService) {
      await FlutterForegroundTask.restartService();
      return true;
    }

    final result = await FlutterForegroundTask.startService(
      serviceId: 256,
      notificationTitle: 'Obbel — lokasi aktif',
      notificationText: 'Mengirim lokasi booth tiap 1 menit selama shift berjalan',
      callback: startLocationCallback,
    );
    return result is ServiceRequestSuccess;
  }

  /// Dipanggil pas check-out — WAJIB, supaya baterai tidak terkuras di luar
  /// jam shift dan booth langsung hilang dari peta "aktif" admin (bukan
  /// nunggu staleness timeout backend).
  Future<void> stop() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(prefApiBaseUrl);
    await prefs.remove(prefAuthToken);
    await prefs.remove(prefShiftId);
    await FlutterForegroundTask.stopService();
  }
}
