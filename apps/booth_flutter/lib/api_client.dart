import 'dart:async';
import 'dart:convert';
import 'dart:io' show SocketException;

import 'package:http/http.dart' as http;
import 'package:http_parser/http_parser.dart';
import 'package:image_picker/image_picker.dart';

const _requestTimeout = Duration(seconds: 15);
// Upload foto (multipart, ratusan KB) butuh jauh lebih banyak waktu daripada
// request JSON biasa di WiFi lambat/kongesti — 15s sering kepotong duluan
// sebelum file selesai terkirim.
const _uploadTimeout = Duration(seconds: 45);

/// Override via `--dart-define=API_BASE_URL=http://10.0.2.2:4000` saat build
/// untuk mengarah ke backend lokal. Tanpa flag ini, default menuju backend
/// production di Coolify (lihat docs/17-deployment-environment.md).
const _apiBaseUrlOverride = String.fromEnvironment('API_BASE_URL');
const _defaultProductionBaseUrl = 'https://obel-backend.apps.7smarts.id';

/// Error dari Backend API, mengikuti envelope {code, message, details} di
/// docs/obbel-coffee-ai-docs/09-api-rpc-contract.md §15.
class ApiException implements Exception {
  ApiException(this.code, this.message, [this.details]);

  final String code;
  final String message;
  final Map<String, dynamic>? details;

  @override
  String toString() => message;
}

/// Client HTTP tipis ke Backend API (Node.js/NestJS). Default menuju backend
/// production di Coolify; override dengan `--dart-define=API_BASE_URL=...`
/// untuk development lokal (mis. `http://10.0.2.2:4000` di emulator Android).
class ApiClient {
  ApiClient({String? baseUrl}) : baseUrl = baseUrl ?? _defaultBaseUrl();

  final String baseUrl;

  static String _defaultBaseUrl() {
    if (_apiBaseUrlOverride.isNotEmpty) return _apiBaseUrlOverride;
    return _defaultProductionBaseUrl;
  }

  Future<Map<String, dynamic>> login(String username, String password) {
    return _post(
      '/auth/login',
      body: {'username': username, 'password': password},
    );
  }

  Future<List<dynamic>> getCatalog(String token) async {
    final result = await _get('/catalog', token: token);
    return result as List<dynamic>;
  }

  Future<Map<String, dynamic>> getActiveShift(String token) async {
    final result = await _get('/shifts/active', token: token);
    return result as Map<String, dynamic>;
  }

  /// Absen Berangkat. `boothId` opsional — kosong berarti server pakai Booth
  /// default dari BoothShiftAssignment staff ybs. `latitude`/`longitude`/
  /// `photoUrl` wajib (GPS + foto selfie, lihat CheckInDto di backend) —
  /// server hanya memakainya sebagai peringatan non-blocking, bukan hard
  /// block (ShiftsService.computeLocationWarning).
  Future<Map<String, dynamic>> checkIn(
    String token, {
    String? boothId,
    required double latitude,
    required double longitude,
    required String photoUrl,
  }) {
    return _post(
      '/shifts/check-in',
      token: token,
      body: {
        'boothId': ?boothId,
        'latitude': latitude,
        'longitude': longitude,
        'photoUrl': photoUrl,
      },
    );
  }

  /// Upload foto selfie Absen Berangkat/Pulang, mengembalikan URL publik yang
  /// dikirim balik sebagai `photoUrl`/`checkOutPhotoUrl` ke checkIn/
  /// confirmShiftClosing (lihat ShiftsController.uploadAttendancePhoto).
  Future<String> uploadAttendancePhoto(String token, XFile photo) async {
    final request =
        http.MultipartRequest(
            'POST',
            Uri.parse('$baseUrl/shifts/attendance/photo'),
          )
          ..headers['Authorization'] = 'Bearer $token'
          ..files.add(
            await http.MultipartFile.fromPath(
              'file',
              photo.path,
              // image_picker's camera capture is always JPEG on Android/iOS;
              // fromPath's extension-based MIME guess can miss on temp-file
              // paths without a recognized extension, so set it explicitly.
              contentType: MediaType('image', 'jpeg'),
            ),
          );

    final response = await _send(() async {
      final streamed = await request.send();
      return http.Response.fromStream(streamed);
    }, timeout: _uploadTimeout);
    final decoded = _decode(response) as Map<String, dynamic>;
    return decoded['photoUrl'] as String;
  }

  /// Preview Booth/Shift yang bakal otomatis terpilih di layar Check-In.
  /// Null berarti staff belum ditugaskan ke Booth manapun.
  Future<Map<String, dynamic>?> getMyAssignment(String token) async {
    final result = await _get('/booth-shift-assignments/mine', token: token);
    return result as Map<String, dynamic>?;
  }

  Future<List<dynamic>> getBooths(String token) async {
    final result = await _get('/booths', token: token);
    return result as List<dynamic>;
  }

  /// GET /sales dipaginasi sejak `ca71c39` (senior) — respons sekarang
  /// `{rows, total, page, limit}`, bukan array polos lagi. `limit=100`
  /// (maksimum server, lihat sales.service.ts) supaya cukup buat kebutuhan
  /// Beranda/Riwayat Penjualan booth_flutter yang belum punya UI pagination.
  Future<List<dynamic>> getSales(String token) async {
    final result = await _get('/sales?limit=100', token: token);
    return (result as Map<String, dynamic>)['rows'] as List<dynamic>;
  }

  Future<List<dynamic>> getPendingDistributions(String token) async {
    final result = await _get('/distributions/pending', token: token);
    return result as List<dynamic>;
  }

  Future<List<dynamic>> getMyDistributions(String token) async {
    final result = await _get('/distributions/mine', token: token);
    return result as List<dynamic>;
  }

  Future<List<dynamic>> getMyRestockRequests(String token) async {
    final result = await _get('/restock-requests/mine', token: token);
    return result as List<dynamic>;
  }

  Future<Map<String, dynamic>> receiveDistribution(
    String token,
    String distributionId,
    List<Map<String, dynamic>> items,
  ) {
    return _post(
      '/distributions/$distributionId/receive',
      token: token,
      body: {'items': items},
    );
  }

  Future<Map<String, dynamic>> createRestockRequest(
    String token,
    List<Map<String, dynamic>> items, {
    String? note,
  }) {
    return _post(
      '/restock-requests',
      token: token,
      body: {'items': items, 'note': ?note},
    );
  }

  Future<Map<String, dynamic>> startShiftClosing(
    String token,
    String shiftSessionId,
  ) {
    return _post('/shifts/$shiftSessionId/closing/start', token: token);
  }

  /// `checkOutLatitude`/`checkOutLongitude`/`checkOutPhotoUrl` wajib (GPS +
  /// foto selfie Absen Pulang, lihat ConfirmClosingDto di backend) — sama
  /// pola soft-check non-blocking dengan checkIn.
  Future<Map<String, dynamic>> confirmShiftClosing(
    String token,
    String shiftSessionId,
    List<Map<String, dynamic>> items, {
    required double checkOutLatitude,
    required double checkOutLongitude,
    required String checkOutPhotoUrl,
  }) {
    return _post(
      '/shifts/$shiftSessionId/closing/confirm',
      token: token,
      body: {
        'items': items,
        'checkOutLatitude': checkOutLatitude,
        'checkOutLongitude': checkOutLongitude,
        'checkOutPhotoUrl': checkOutPhotoUrl,
      },
    );
  }

  Future<Map<String, dynamic>> createReturn(String token) {
    return _post('/returns', token: token, body: {});
  }

  Future<Map<String, dynamic>> createSale(
    String token, {
    required String idempotencyKey,
    required String shiftSessionId,
    required String paymentMethod,
    required List<Map<String, dynamic>> items,
  }) {
    return _post(
      '/sales',
      token: token,
      body: {
        'idempotencyKey': idempotencyKey,
        'shiftSessionId': shiftSessionId,
        'paymentMethod': paymentMethod,
        'items': items,
      },
    );
  }

  Future<List<dynamic>> getNotifications(String token) async {
    final result = await _get('/notifications', token: token);
    return result as List<dynamic>;
  }

  /// Retry sekali kalau kena TIMEOUT — GET tidak punya efek samping jadi
  /// aman diulang, beda dari POST (restock/return/dll belum semua punya
  /// idempotency key, lihat CLAUDE.md P0) yang sengaja TIDAK di-retry di
  /// sini supaya tidak dobel-submit ke server kalau request pertama
  /// sebenarnya sudah diproses tapi responsnya lambat balik.
  Future<dynamic> _get(String path, {String? token}) async {
    final uri = Uri.parse('$baseUrl$path');
    final headers = _headers(token);
    try {
      return _decode(await _send(() => http.get(uri, headers: headers)));
    } on ApiException catch (e) {
      if (e.code != 'TIMEOUT') rethrow;
      return _decode(await _send(() => http.get(uri, headers: headers)));
    }
  }

  Future<Map<String, dynamic>> _post(
    String path, {
    String? token,
    Map<String, dynamic>? body,
  }) async {
    final response = await _send(
      () => http.post(
        Uri.parse('$baseUrl$path'),
        headers: _headers(token),
        body: jsonEncode(body ?? {}),
      ),
    );
    return _decode(response) as Map<String, dynamic>;
  }

  /// Membungkus request supaya timeout & putus koneksi selalu jadi
  /// ApiException berpesan jelas (docs/11-notification-printing-offline.md
  /// §8: "timeout message jelas"), bukan exception mentah yang tidak
  /// ditangkap oleh `on ApiException catch` di layar-layar pemanggil.
  Future<http.Response> _send(
    Future<http.Response> Function() request, {
    Duration timeout = _requestTimeout,
  }) async {
    try {
      return await request().timeout(timeout);
    } on TimeoutException {
      throw ApiException(
        'TIMEOUT',
        'Koneksi ke server timeout. Periksa jaringan Anda lalu coba lagi.',
      );
    } on SocketException {
      throw ApiException(
        'NETWORK_ERROR',
        'Tidak dapat terhubung ke server. Periksa koneksi lalu coba lagi.',
      );
    } on ApiException {
      rethrow;
    } catch (_) {
      throw ApiException(
        'NETWORK_ERROR',
        'Terjadi masalah koneksi. Periksa jaringan Anda lalu coba lagi.',
      );
    }
  }

  Map<String, String> _headers(String? token) => {
    'Content-Type': 'application/json',
    if (token != null) 'Authorization': 'Bearer $token',
  };

  dynamic _decode(http.Response response) {
    final decoded = response.body.isEmpty ? null : jsonDecode(response.body);
    if (response.statusCode >= 200 && response.statusCode < 300) {
      return decoded;
    }

    if (decoded is Map<String, dynamic> && decoded['code'] != null) {
      final rawMessage = decoded['message'];
      final message = rawMessage is List
          ? rawMessage.join(', ')
          : rawMessage.toString();
      throw ApiException(
        decoded['code'] as String,
        message,
        decoded['details'] as Map<String, dynamic>?,
      );
    }
    throw ApiException(
      'UNKNOWN_ERROR',
      'Terjadi kesalahan (${response.statusCode}).',
    );
  }
}
