import 'package:flutter/foundation.dart';

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
}
