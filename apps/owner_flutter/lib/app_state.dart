import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:path_provider/path_provider.dart';

import 'api_client.dart';

class AppState extends ChangeNotifier {
  AppState({ApiClient? api}) : _api = api ?? ApiClient();

  final ApiClient _api;

  String? _token;
  String? _fullName;
  String? _error;
  bool _loading = false;

  Map<String, dynamic>? executiveHome;
  List<dynamic> boothRanking = [];
  Map<String, dynamic>? stockCondition;
  List<dynamic> discrepancy = [];
  Map<String, dynamic>? reportsSummary;
  List<dynamic> notifications = [];

  bool get isLoggedIn => _token != null;
  String? get fullName => _fullName;
  String? get error => _error;
  bool get loading => _loading;

  Future<bool> login(String username, String password) async {
    _loading = true;
    _error = null;
    notifyListeners();
    try {
      final result = await _api.login(username, password);
      _token = result['accessToken'] as String;
      _fullName = (result['profile'] as Map<String, dynamic>)['fullName'] as String;
      await refreshExecutiveHome();
      return true;
    } on ApiException catch (e) {
      _error = e.message;
      return false;
    } finally {
      _loading = false;
      notifyListeners();
    }
  }

  void logout() {
    _token = null;
    _fullName = null;
    executiveHome = null;
    boothRanking = [];
    notifyListeners();
  }

  Future<void> refreshExecutiveHome() async {
    if (_token == null) return;
    executiveHome = await _api.getExecutiveHome(_token!);
    notifyListeners();
  }

  Future<void> refreshBoothRanking(String period) async {
    if (_token == null) return;
    boothRanking = await _api.getBoothRanking(_token!, period);
    notifyListeners();
  }

  Future<Map<String, dynamic>> loadBoothDetail(String boothId) async {
    return _api.getBoothDetail(_token!, boothId);
  }

  Future<void> refreshStockCondition() async {
    if (_token == null) return;
    stockCondition = await _api.getStockCondition(_token!);
    notifyListeners();
  }

  Future<void> refreshDiscrepancy() async {
    if (_token == null) return;
    discrepancy = await _api.getDiscrepancy(_token!);
    notifyListeners();
  }

  Future<void> refreshReportsSummary() async {
    if (_token == null) return;
    reportsSummary = await _api.getReportsSummary(_token!);
    notifyListeners();
  }

  Future<void> refreshNotifications() async {
    if (_token == null) return;
    notifications = await _api.getNotifications(_token!);
    notifyListeners();
  }

  /// Simpan laporan CSV ke penyimpanan lokal aplikasi dan kembalikan path
  /// filenya untuk ditampilkan ke Owner.
  Future<String> exportReportsCsv() async {
    final csv = await _api.exportReportsCsv(_token!);
    final dir = await getApplicationDocumentsDirectory();
    final timestamp = DateTime.now().millisecondsSinceEpoch;
    final file = File('${dir.path}/laporan-obbel-$timestamp.csv');
    await file.writeAsString(csv);
    return file.path;
  }
}
