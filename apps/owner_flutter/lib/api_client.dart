import 'dart:convert';
import 'dart:io' show Platform;

import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:http/http.dart' as http;

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

/// Client HTTP read-only ke Backend API yang sama dipakai Petugas Booth dan
/// Admin Pusat — Owner tidak boleh melakukan koreksi (24-...md §4).
class ApiClient {
  ApiClient({String? baseUrl}) : baseUrl = baseUrl ?? _defaultBaseUrl();

  final String baseUrl;

  static String _defaultBaseUrl() {
    if (kIsWeb) return 'http://localhost:3000';
    if (Platform.isAndroid) return 'http://10.0.2.2:3000';
    return 'http://localhost:3000';
  }

  Future<Map<String, dynamic>> login(String username, String password) {
    return _post('/auth/login', body: {'username': username, 'password': password});
  }

  Future<Map<String, dynamic>> getExecutiveHome(String token) async {
    final result = await _get('/owner/dashboard', token: token);
    return result as Map<String, dynamic>;
  }

  Future<List<dynamic>> getBoothRanking(String token, String period) async {
    final result = await _get('/owner/booth-ranking?period=$period', token: token);
    return result as List<dynamic>;
  }

  Future<Map<String, dynamic>> getBoothDetail(String token, String boothId) async {
    final result = await _get('/owner/booths/$boothId', token: token);
    return result as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> getReportsSummary(String token) async {
    final result = await _get('/reports/summary', token: token);
    return result as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> getStockCondition(String token) async {
    final result = await _get('/owner/stock-condition', token: token);
    return result as Map<String, dynamic>;
  }

  Future<List<dynamic>> getDiscrepancy(String token) async {
    final result = await _get('/owner/discrepancy', token: token);
    return result as List<dynamic>;
  }

  Future<List<dynamic>> getNotifications(String token) async {
    final result = await _get('/notifications', token: token);
    return result as List<dynamic>;
  }

  Future<String> exportReportsCsv(String token) async {
    final response = await http.get(Uri.parse('$baseUrl/reports/export'), headers: _headers(token));
    if (response.statusCode >= 200 && response.statusCode < 300) {
      return response.body;
    }
    throw ApiException('EXPORT_FAILED', 'Gagal mengunduh laporan (${response.statusCode}).');
  }

  Future<dynamic> _get(String path, {String? token}) async {
    final response = await http.get(Uri.parse('$baseUrl$path'), headers: _headers(token));
    return _decode(response);
  }

  Future<Map<String, dynamic>> _post(String path, {String? token, Map<String, dynamic>? body}) async {
    final response = await http.post(
      Uri.parse('$baseUrl$path'),
      headers: _headers(token),
      body: jsonEncode(body ?? {}),
    );
    return _decode(response) as Map<String, dynamic>;
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
      final message = rawMessage is List ? rawMessage.join(', ') : rawMessage.toString();
      throw ApiException(decoded['code'] as String, message, decoded['details'] as Map<String, dynamic>?);
    }
    throw ApiException('UNKNOWN_ERROR', 'Terjadi kesalahan (${response.statusCode}).');
  }
}
