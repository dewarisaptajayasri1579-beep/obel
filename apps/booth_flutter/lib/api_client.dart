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

/// Client HTTP tipis ke Backend API (Node.js/NestJS). Emulator Android tidak
/// bisa memakai "localhost" untuk mengakses host — dipetakan ke 10.0.2.2.
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

  Future<List<dynamic>> getCatalog(String token) async {
    final result = await _get('/catalog', token: token);
    return result as List<dynamic>;
  }

  Future<Map<String, dynamic>> getActiveShift(String token) async {
    final result = await _get('/shifts/active', token: token);
    return result as Map<String, dynamic>;
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

  Future<dynamic> _get(String path, {String? token}) async {
    final response = await http.get(
      Uri.parse('$baseUrl$path'),
      headers: _headers(token),
    );
    return _decode(response);
  }

  Future<Map<String, dynamic>> _post(
    String path, {
    String? token,
    Map<String, dynamic>? body,
  }) async {
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
      throw ApiException(
        decoded['code'] as String,
        message,
        decoded['details'] as Map<String, dynamic>?,
      );
    }
    throw ApiException('UNKNOWN_ERROR', 'Terjadi kesalahan (${response.statusCode}).');
  }
}
