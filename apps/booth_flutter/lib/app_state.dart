import 'package:flutter/foundation.dart';
import 'package:uuid/uuid.dart';

import 'api_client.dart';
import 'models.dart';

const _uuid = Uuid();

String _fmtTime(DateTime dt) =>
    '${dt.hour.toString().padLeft(2, '0')}.${dt.minute.toString().padLeft(2, '0')}';

/// State bersama seluruh layar Petugas Booth. Login, katalog/stok,
/// distribusi (terima stok), dan checkout semuanya memanggil Backend API
/// sungguhan (lihat api_client.dart) — tidak ada data mock lagi.
class AppState extends ChangeNotifier {
  AppState({ApiClient? apiClient}) : _api = apiClient ?? ApiClient();

  final ApiClient _api;
  String? _token;
  String? _pendingDistributionId;

  bool loggedIn = false;
  bool loading = false;

  String staffName = '';
  String boothName = '';
  String shiftLabel = '';
  String shiftTime = '';
  String? shiftSessionId;

  List<Product> catalog = [];
  List<BoothStock> stock = [];
  final List<CartItem> cart = [];
  List<InboundItem>? pendingInbound;
  final Map<String, int> soldQtyByProductId = {};

  int omzetToday = 0;
  int cupSoldToday = 0;
  int transactionCount = 0;

  int get cartCount => cart.fold(0, (sum, item) => sum + item.quantity);
  int get cartTotal => cart.fold(0, (sum, item) => sum + item.totalPrice);
  int get lowStockCount => stock.where((s) => s.status != 'Aman').length;
  int get averagePerTransaction =>
      transactionCount == 0 ? 0 : (omzetToday / transactionCount).round();

  List<BoothStock> get topStock {
    final sorted = [...stock]..sort((a, b) => b.currentQty.compareTo(a.currentQty));
    return sorted.take(3).toList();
  }

  List<MapEntry<String, int>> get topSelling {
    final entries = soldQtyByProductId.entries.toList()
      ..sort((a, b) => b.value.compareTo(a.value));
    return entries.take(3).toList();
  }

  String productName(String productId) =>
      catalog.firstWhere((p) => p.id == productId, orElse: () => catalog.first).name;

  int stockQtyFor(String productId) {
    final match = stock.where((s) => s.product.id == productId);
    return match.isEmpty ? 0 : match.first.currentQty;
  }

  Future<void> login(String username, String password) async {
    loading = true;
    notifyListeners();
    try {
      final result = await _api.login(username, password);
      _token = result['accessToken'] as String;
      final profile = result['profile'] as Map<String, dynamic>;
      staffName = profile['fullName'] as String;

      await _loadShiftAndCatalog();
      loggedIn = true;
    } on ApiException {
      rethrow;
    } catch (_) {
      throw ApiException(
        'NETWORK_ERROR',
        'Tidak dapat terhubung ke server. Periksa koneksi lalu coba lagi.',
      );
    } finally {
      loading = false;
      notifyListeners();
    }
  }

  void logout() {
    _token = null;
    loggedIn = false;
    cart.clear();
    notifyListeners();
  }

  Future<void> _loadShiftAndCatalog() async {
    final shift = await _api.getActiveShift(_token!);
    boothName = (shift['booth'] as Map)['name'] as String;
    shiftSessionId = shift['shiftSessionId'] as String;
    shiftLabel = '${shift['shiftName']} AKTIF'.toUpperCase();
    final startAt = DateTime.parse(shift['scheduledStartAt'] as String).toLocal();
    final endAt = DateTime.parse(shift['scheduledEndAt'] as String).toLocal();
    shiftTime = '${_fmtTime(startAt)} - ${_fmtTime(endAt)}';

    await refreshCatalog();
    await refreshPendingDistribution();
  }

  /// Mengambil distribusi SENT pertama yang menunggu diterima booth ini
  /// (GET /distributions/pending). UI Beranda/Terima Stok hanya menampilkan
  /// satu kartu inbound sekaligus, sesuai mockup.
  Future<void> refreshPendingDistribution() async {
    if (_token == null) return;
    final distributions = await _api.getPendingDistributions(_token!);
    if (distributions.isEmpty) {
      _pendingDistributionId = null;
      pendingInbound = null;
      notifyListeners();
      return;
    }

    final first = distributions.first as Map<String, dynamic>;
    _pendingDistributionId = first['id'] as String;
    pendingInbound = (first['items'] as List<dynamic>).map((raw) {
      final item = raw as Map<String, dynamic>;
      final qtySent = item['qtySent'] as int;
      return InboundItem(
        product: Product(
          id: item['productId'] as String,
          name: item['productName'] as String,
          price: (item['sellPrice'] as num).toInt(),
          category: '',
          imagePath: '',
        ),
        expectedQty: qtySent,
        actualQty: qtySent,
      );
    }).toList();
    notifyListeners();
  }

  Future<void> refreshCatalog() async {
    if (_token == null) return;
    final items = await _api.getCatalog(_token!);
    final products = <Product>[];
    final stocks = <BoothStock>[];

    for (final raw in items) {
      final map = raw as Map<String, dynamic>;
      final product = Product(
        id: map['id'] as String,
        name: map['name'] as String,
        price: (map['sellPrice'] as num).toInt(),
        category: (map['category'] as String?) ?? '',
        imagePath: '',
      );
      final qty = map['qtyOnHand'] as int;
      final status = map['status'] as String;
      products.add(product);
      stocks.add(BoothStock(product: product, currentQty: qty, status: status));
    }

    catalog = products;
    stock = stocks;
    notifyListeners();
  }

  void addToCart(Product product) {
    final available = stockQtyFor(product.id);
    final currentQty = cart
        .where((c) => c.product.id == product.id)
        .fold(0, (sum, c) => sum + c.quantity);
    if (currentQty >= available) return;

    final existingIndex = cart.indexWhere((item) => item.product.id == product.id);
    if (existingIndex >= 0) {
      cart[existingIndex].quantity++;
    } else {
      cart.add(CartItem(product: product));
    }
    notifyListeners();
  }

  void incrementCartItem(CartItem item) {
    final available = stockQtyFor(item.product.id);
    if (item.quantity >= available) return;
    item.quantity++;
    notifyListeners();
  }

  void decrementCartItem(CartItem item) {
    if (item.quantity > 1) {
      item.quantity--;
    } else {
      cart.removeWhere((c) => c.product.id == item.product.id);
    }
    notifyListeners();
  }

  void clearCart() {
    cart.clear();
    notifyListeners();
  }

  /// Memanggil POST /sales (create_paid_sale). Server yang menghitung
  /// harga & memotong stok; kita cukup refresh katalog sesudahnya supaya
  /// tetap sinkron dengan source of truth di backend.
  Future<int> checkout(String paymentMethod) async {
    if (_token == null || shiftSessionId == null) {
      throw ApiException('SHIFT_NOT_OPEN', 'Shift tidak ditemukan, silakan login ulang.');
    }

    final cupCount = cartCount;
    final soldSnapshot = cart.map((c) => MapEntry(c.product.id, c.quantity)).toList();

    final result = await _api.createSale(
      _token!,
      idempotencyKey: _uuid.v4(),
      shiftSessionId: shiftSessionId!,
      paymentMethod: paymentMethod,
      items: cart.map((c) => {'productId': c.product.id, 'qty': c.quantity}).toList(),
    );

    final total = (result['total'] as num).toInt();

    for (final entry in soldSnapshot) {
      soldQtyByProductId.update(entry.key, (v) => v + entry.value, ifAbsent: () => entry.value);
    }
    omzetToday += total;
    cupSoldToday += cupCount;
    transactionCount += 1;
    cart.clear();

    await refreshCatalog();
    return total;
  }

  void updateInboundQty(InboundItem item, int qty) {
    if (qty < 0) return;
    item.actualQty = qty;
    notifyListeners();
  }

  /// Memanggil POST /distributions/:id/receive. Server yang menambah
  /// booth_stocks & mencatat stock_movements; kita refresh katalog + daftar
  /// pending sesudahnya supaya tetap sinkron dengan backend.
  Future<void> receiveInbound() async {
    final items = pendingInbound;
    final distributionId = _pendingDistributionId;
    if (items == null || distributionId == null || _token == null) return;

    await _api.receiveDistribution(
      _token!,
      distributionId,
      items.map((i) => {'productId': i.product.id, 'actualQty': i.actualQty}).toList(),
    );

    await refreshCatalog();
    await refreshPendingDistribution();
  }

  /// Memanggil POST /restock-requests. Belum ada efek stok sampai Admin
  /// approve (BR-008/BR-009) — Booth hanya mengajukan permintaan di sini.
  Future<void> requestRestock(Product product, int qty) async {
    if (_token == null) return;
    await _api.createRestockRequest(
      _token!,
      [{'productId': product.id, 'qty': qty}],
    );
  }

  /// Memanggil POST /shifts/:id/closing/start (get_expected_stock snapshot).
  Future<List<ClosingCountItem>> startShiftClosing() async {
    if (_token == null || shiftSessionId == null) {
      throw ApiException('SHIFT_NOT_OPEN', 'Shift tidak ditemukan, silakan login ulang.');
    }
    final result = await _api.startShiftClosing(_token!, shiftSessionId!);
    return (result['items'] as List<dynamic>).map((raw) {
      final item = raw as Map<String, dynamic>;
      return ClosingCountItem(
        productId: item['productId'] as String,
        productName: item['productName'] as String,
        expectedQty: item['expectedQty'] as int,
        actualQty: item['actualQty'] as int,
      );
    }).toList();
  }

  /// Memanggil POST /shifts/:id/closing/confirm. Server yang menyesuaikan
  /// booth_stocks ke actual & menutup shift (BR-011/BR-012).
  Future<void> confirmShiftClosing(List<ClosingCountItem> items) async {
    if (_token == null || shiftSessionId == null) return;
    await _api.confirmShiftClosing(
      _token!,
      shiftSessionId!,
      items.map((i) => {
            'productId': i.productId,
            'actualQty': i.actualQty,
            if (i.reasonCode != null) 'reasonCode': i.reasonCode,
          }).toList(),
    );
  }

  /// Memanggil POST /returns. Server otomatis memakai seluruh sisa stok
  /// Booth sebagai qty return (BR-013), lalu mengeluarkannya dari
  /// booth_stocks supaya tidak bisa dijual lagi. Kita refresh stok
  /// sesudahnya supaya UI (harusnya 0 semua) tetap sinkron.
  Future<void> submitReturn() async {
    if (_token == null) return;
    await _api.createReturn(_token!);
    await refreshCatalog();
  }
}
