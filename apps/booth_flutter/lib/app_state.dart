import 'package:flutter/foundation.dart';
import 'package:uuid/uuid.dart';

import 'api_client.dart';
import 'models.dart';

const _minimumQty = 25;
const _criticalQty = 10;
const _uuid = Uuid();

String _statusFor(int qty) {
  if (qty <= 0) return 'Habis';
  if (qty <= _criticalQty) return 'Kritis';
  if (qty <= _minimumQty) return 'Menipis';
  return 'Aman';
}

String _fmtTime(DateTime dt) =>
    '${dt.hour.toString().padLeft(2, '0')}.${dt.minute.toString().padLeft(2, '0')}';

/// State bersama seluruh layar Petugas Booth. Login, katalog/stok, dan
/// checkout memanggil Backend API sungguhan (lihat api_client.dart).
/// Terima Stok masih data mock karena Backend API belum menyediakan endpoint
/// distribusi — akan diganti begitu modul itu dibangun.
class AppState extends ChangeNotifier {
  AppState({ApiClient? apiClient}) : _api = apiClient ?? ApiClient();

  final ApiClient _api;
  String? _token;

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
  List<InboundItem>? pendingInbound = [
    InboundItem(
      product: const Product(id: 'mock-1', name: 'Original', price: 8000, category: 'Coffee Milk', imagePath: ''),
      expectedQty: 10,
      actualQty: 10,
    ),
    InboundItem(
      product: const Product(id: 'mock-2', name: 'Brown Sugar', price: 10000, category: 'Coffee Milk', imagePath: ''),
      expectedQty: 5,
      actualQty: 5,
    ),
  ];
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
      products.add(product);
      stocks.add(BoothStock(product: product, currentQty: qty, status: _statusFor(qty)));
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

  /// Mock — belum ada endpoint distribusi di Backend API. Menambahkan qty
  /// ke stok lokal supaya UI tetap bisa didemokan sebelum modul itu ada.
  void receiveInbound() {
    final items = pendingInbound;
    if (items == null) return;
    for (final item in items) {
      final idx = stock.indexWhere((s) => s.product.name == item.product.name);
      if (idx >= 0) {
        stock[idx].currentQty += item.actualQty;
      }
    }
    pendingInbound = null;
    notifyListeners();
  }
}
