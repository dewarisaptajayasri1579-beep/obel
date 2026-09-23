import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:uuid/uuid.dart';

import 'api_client.dart';
import 'models.dart';

const _uuid = Uuid();
const _tokenPrefsKey = 'auth_token';
const _staffNamePrefsKey = 'auth_staff_name';

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

  /// true kalau baru saja login tapi belum ada ShiftSession aktif — layar
  /// Check-In (Absen Berangkat) yang harus tampil dulu, bukan MainShell.
  bool needsCheckIn = false;

  String? staffId;
  String staffName = '';
  String? defaultBoothId;
  String boothName = '';
  String shiftLabel = '';
  String shiftTime = '';
  String? shiftSessionId;

  List<Product> catalog = [];
  List<BoothStock> stock = [];
  final List<CartItem> cart = [];
  List<InboundItem>? pendingInbound;

  List<Map<String, dynamic>> notifications = [];
  List<Map<String, dynamic>> restockRequests = [];
  List<SaleHistoryRecord> sales = [];
  bool get hasUnreadNotifications => notifications.isNotEmpty;

  int get cartCount => cart.fold(0, (sum, item) => sum + item.quantity);
  int get cartTotal => cart.fold(0, (sum, item) => sum + item.totalPrice);
  int get lowStockCount => stock.where((s) => s.status != 'Aman').length;
  int stockStatusCount(String status) =>
      stock.where((s) => s.status.toLowerCase() == status.toLowerCase()).length;
  int stockQuantityForStatus(String status) => stock
      .where((s) => s.status.toLowerCase() == status.toLowerCase())
      .fold(0, (total, item) => total + item.currentQty);

  /// Dihitung ulang dari `sales` (hasil GET /sales, sumber kebenaran server),
  /// bukan counter lokal — supaya angka ini tetap benar setelah app di-restart
  /// (Hot Restart / OS kill / restoreSession), bukan cuma nambah dalam sesi
  /// yang sedang berjalan. Hanya sale PAID hari ini yang dihitung, konsisten
  /// dengan "omzet bersih" di dashboard Admin/Owner.
  List<SaleHistoryRecord> get _todaysPaidSales {
    final now = DateTime.now();
    return sales.where((s) {
      if (s.status != 'PAID') return false;
      final paid = s.paidAt;
      return paid.year == now.year &&
          paid.month == now.month &&
          paid.day == now.day;
    }).toList();
  }

  int get transactionCount => _todaysPaidSales.length;
  int get omzetToday => _todaysPaidSales.fold(0, (sum, s) => sum + s.total);
  int get cupSoldToday => _todaysPaidSales.fold(
    0,
    (sum, s) => sum + s.items.fold(0, (a, item) => a + item.qty),
  );
  int get averagePerTransaction =>
      transactionCount == 0 ? 0 : (omzetToday / transactionCount).round();

  List<BoothStock> get topStock {
    final sorted = [...stock]
      ..sort((a, b) => b.currentQty.compareTo(a.currentQty));
    return sorted.take(3).toList();
  }

  Map<String, int> get soldQtyByProductId {
    final result = <String, int>{};
    for (final sale in _todaysPaidSales) {
      for (final item in sale.items) {
        final id = item.productId;
        if (id == null) continue;
        result.update(id, (v) => v + item.qty, ifAbsent: () => item.qty);
      }
    }
    return result;
  }

  List<MapEntry<String, int>> get topSelling {
    final entries = soldQtyByProductId.entries.toList()
      ..sort((a, b) => b.value.compareTo(a.value));
    return entries.take(3).toList();
  }

  String productName(String productId) => catalog
      .firstWhere((p) => p.id == productId, orElse: () => catalog.first)
      .name;

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
      staffId = profile['id'] as String?;
      staffName = profile['fullName'] as String;
      defaultBoothId = profile['defaultBoothId'] as String?;

      try {
        await _loadShiftAndCatalog();
        needsCheckIn = false;
      } on ApiException catch (e) {
        if (e.code == 'NOT_FOUND') {
          // Belum ada shift aktif — bukan error, staff perlu Check-In dulu.
          needsCheckIn = true;
        } else {
          rethrow;
        }
      }
      loggedIn = true;

      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(_tokenPrefsKey, _token!);
      await prefs.setString(_staffNamePrefsKey, staffName);
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

  /// Dipanggil sekali saat app baru dibuka (lihat splash_screen.dart).
  /// Mencoba pulihkan sesi dari token yang tersimpan lokal, supaya Petugas
  /// tidak perlu login ulang tiap kali app di-kill OS / device restart
  /// (bukan cuma soal Hot Restart saat development).
  Future<bool> restoreSession() async {
    final prefs = await SharedPreferences.getInstance();
    final savedToken = prefs.getString(_tokenPrefsKey);
    if (savedToken == null) return false;

    _token = savedToken;
    staffName = prefs.getString(_staffNamePrefsKey) ?? '';
    try {
      await _loadShiftAndCatalog();
      loggedIn = true;
      notifyListeners();
      return true;
    } catch (_) {
      // Token invalid/expired, atau network error saat startup — jangan
      // paksa masuk, biarkan Petugas login manual lagi.
      _token = null;
      staffName = '';
      await prefs.remove(_tokenPrefsKey);
      await prefs.remove(_staffNamePrefsKey);
      return false;
    }
  }

  void logout() {
    _token = null;
    staffName = '';
    loggedIn = false;
    needsCheckIn = false;
    cart.clear();
    sales.clear();
    unawaited(
      SharedPreferences.getInstance().then((p) {
        p.remove(_tokenPrefsKey);
        p.remove(_staffNamePrefsKey);
      }),
    );
    notifyListeners();
  }

  Future<void> _loadShiftAndCatalog() async {
    final shift = await _api.getActiveShift(_token!);
    final newToken = shift['accessToken'] as String?;
    if (newToken != null) _token = newToken;
    _applyActiveShift(shift);

    await refreshCatalog();
    await refreshSales();
    await refreshPendingDistribution();
    await refreshRestockRequests();
    await refreshNotifications();
  }

  void _applyActiveShift(Map<String, dynamic> shift) {
    boothName = (shift['booth'] as Map)['name'] as String;
    shiftSessionId = shift['shiftSessionId'] as String;
    shiftLabel = '${shift['shiftName']} AKTIF'.toUpperCase();
    final startAt = DateTime.parse(shift['scheduledStartAt'] as String)
        .toLocal();
    final endAt = DateTime.parse(shift['scheduledEndAt'] as String).toLocal();
    shiftTime = '${_fmtTime(startAt)} - ${_fmtTime(endAt)}';
  }

  /// Preview Booth/Shift yang otomatis terpilih untuk layar Check-In —
  /// null kalau staff belum ditugaskan ke Booth manapun.
  Future<Map<String, dynamic>?> getMyAssignment() async {
    if (_token == null) return null;
    return _api.getMyAssignment(_token!);
  }

  Future<List<dynamic>> getBooths() async {
    if (_token == null) return [];
    return _api.getBooths(_token!);
  }

  /// Absen Berangkat (POST /shifts/check-in). Server yang menentukan Booth
  /// default dari BoothShiftAssignment kalau `boothId` tidak dikirim.
  /// Setelah berhasil, ShiftSession-nya OPEN — muat ulang katalog/stok/dll
  /// persis seperti alur login yang sudah punya shift aktif.
  ///
  /// Kapture GPS + upload foto selfie (AttendanceCaptureCard/
  /// uploadAttendancePhoto) SEMENTARA di-skip — dicurigai jadi sumber
  /// "Koneksi ke server timeout" berulang di device tertentu (belum
  /// diverifikasi apakah upload multipart-nya, atau geolocator-nya, yang
  /// macet). `photoUrl` sekarang cuma placeholder server-side valid, bukan
  /// foto sungguhan. Re-enable setelah root cause ketemu — lihat
  /// AttendanceCaptureCard di attendance_capture.dart, masih utuh, tinggal
  /// disambung lagi.
  Future<void> checkIn({String? boothId}) async {
    if (_token == null) {
      throw ApiException(
        'AUTH_REQUIRED',
        'Sesi login berakhir, silakan login ulang.',
      );
    }
    final shift = await _api.checkIn(
      _token!,
      boothId: boothId,
      latitude: 0,
      longitude: 0,
      photoUrl: 'disabled-temporarily',
    );
    final newToken = shift['accessToken'] as String?;
    if (newToken != null) _token = newToken;
    _applyActiveShift(shift);
    needsCheckIn = false;
    notifyListeners();

    await refreshCatalog();
    await refreshSales();
    await refreshPendingDistribution();
    await refreshRestockRequests();
    await refreshNotifications();
  }

  /// Memanggil GET /notifications (khusus Booth: stok kritis di booth ini,
  /// distribusi menunggu diterima, restock yang sudah disetujui).
  Future<void> refreshNotifications() async {
    if (_token == null) return;
    final items = await _api.getNotifications(_token!);
    notifications = items.cast<Map<String, dynamic>>();
    notifyListeners();
  }

  /// Mengambil pengajuan restock milik booth agar detail jumlah yang diajukan
  /// tetap mengikuti data transaksi server, bukan hanya teks notifikasi.
  Future<void> refreshRestockRequests() async {
    if (_token == null) return;
    try {
      final items = await _api.getMyRestockRequests(_token!);
      restockRequests = items.cast<Map<String, dynamic>>();
      notifyListeners();
    } on ApiException {
      // Riwayat notifikasi tetap dapat ditampilkan bila endpoint detail gagal.
    }
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
          sku: '',
          name: item['productName'] as String,
          price: (item['sellPrice'] as num).toInt(),
          category: '',
          imageUrl: null,
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
      final rawImageUrl = (map['imageUrl'] as String?)?.trim();
      final product = Product(
        id: map['id'] as String,
        sku: (map['sku'] as String?) ?? '',
        name: map['name'] as String,
        price: (map['sellPrice'] as num).toInt(),
        category: (map['category'] as String?) ?? '',
        imageUrl: _resolveImageUrl(rawImageUrl),
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

  String? _resolveImageUrl(String? imageUrl) {
    if (imageUrl == null || imageUrl.isEmpty) return null;

    final imageUri = Uri.tryParse(imageUrl);
    final apiUri = Uri.tryParse(_api.baseUrl);
    if (imageUri == null || apiUri == null || !imageUri.hasScheme) {
      return imageUrl;
    }

    if (imageUri.host != 'localhost' &&
        imageUri.host != '127.0.0.1' &&
        imageUri.host != '0.0.0.0') {
      return imageUrl;
    }

    return imageUri
        .replace(
          scheme: apiUri.scheme,
          host: apiUri.host,
          port: apiUri.hasPort ? apiUri.port : null,
        )
        .toString();
  }

  Future<void> refreshSales() async {
    if (_token == null) return;
    try {
      final items = await _api.getSales(_token!);
      sales = items.map((raw) {
        final item = raw as Map<String, dynamic>;
        return SaleHistoryRecord(
          saleNo: item['saleNo'] as String,
          total: (item['total'] as num).toInt(),
          paymentMethod: item['paymentMethod'] as String,
          status: item['status'] as String,
          paidAt: DateTime.parse(item['paidAt'] as String).toLocal(),
          items: (item['items'] as List<dynamic>).map((rawItem) {
            final saleItem = rawItem as Map<String, dynamic>;
            return SaleHistoryItem(
              productId: saleItem['productId'] as String?,
              productName: saleItem['productName'] as String,
              qty: saleItem['qty'] as int,
            );
          }).toList(),
        );
      }).toList();
      notifyListeners();
    } on ApiException {
      // History is supplementary; it must not block login or checkout.
    }
  }

  Future<String> submitRestock(List<Map<String, dynamic>> items) async {
    if (_token == null) {
      throw ApiException(
        'AUTH_REQUIRED',
        'Sesi login berakhir, silakan login ulang.',
      );
    }

    final result = await _api.createRestockRequest(_token!, items);
    return result['requestNo'] as String;
  }

  void addToCart(Product product) {
    final available = stockQtyFor(product.id);
    final currentQty = cart
        .where((c) => c.product.id == product.id)
        .fold(0, (sum, c) => sum + c.quantity);
    if (currentQty >= available) return;

    final existingIndex = cart.indexWhere(
      (item) => item.product.id == product.id,
    );
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
  /// tetap sinkron dengan source of truth di backend. Mengembalikan
  /// saleNo/total/item snapshot (untuk cetak struk) sebelum cart di-clear.
  Future<CompletedSale> checkout(String paymentMethod) async {
    if (_token == null || shiftSessionId == null) {
      throw ApiException(
        'SHIFT_NOT_OPEN',
        'Shift tidak ditemukan, silakan login ulang.',
      );
    }

    final soldSnapshot = cart
        .map((c) => MapEntry(c.product.id, c.quantity))
        .toList();
    final itemSnapshot = cart
        .map(
          (c) => CompletedSaleItem(
            name: c.product.name,
            qty: c.quantity,
            price: c.product.price,
          ),
        )
        .toList();

    final result = await _api.createSale(
      _token!,
      idempotencyKey: _uuid.v4(),
      shiftSessionId: shiftSessionId!,
      paymentMethod: paymentMethod,
      items: cart
          .map((c) => {'productId': c.product.id, 'qty': c.quantity})
          .toList(),
    );

    final total = (result['total'] as num).toInt();
    cart.clear();

    sales.insert(
      0,
      SaleHistoryRecord(
        saleNo: result['saleNo'] as String,
        total: total,
        paymentMethod: paymentMethod,
        status: 'PAID',
        paidAt: DateTime.now(),
        items: [
          for (final entry in soldSnapshot)
            SaleHistoryItem(
              productId: entry.key,
              productName: productName(entry.key),
              qty: entry.value,
            ),
        ],
      ),
    );
    notifyListeners();

    await refreshCatalog();
    await refreshSales();
    return CompletedSale(
      saleNo: result['saleNo'] as String,
      total: total,
      paymentMethod: paymentMethod,
      items: itemSnapshot,
    );
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
      items
          .map((i) => {'productId': i.product.id, 'actualQty': i.actualQty})
          .toList(),
    );

    await refreshCatalog();
    await refreshPendingDistribution();
  }

  /// Memanggil POST /restock-requests. Belum ada efek stok sampai Admin
  /// approve (BR-008/BR-009) — Booth hanya mengajukan permintaan di sini.
  Future<void> requestRestock(Product product, int qty) async {
    if (_token == null) return;
    await _api.createRestockRequest(_token!, [
      {'productId': product.id, 'qty': qty},
    ]);
  }

  /// Memanggil POST /shifts/:id/closing/start (get_expected_stock snapshot).
  Future<List<ClosingCountItem>> startShiftClosing() async {
    if (_token == null || shiftSessionId == null) {
      throw ApiException(
        'SHIFT_NOT_OPEN',
        'Shift tidak ditemukan, silakan login ulang.',
      );
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
  /// booth_stocks ke actual & menutup shift (BR-011/BR-012). Sama seperti
  /// checkIn(), GPS + upload foto Absen Pulang SEMENTARA di-skip — lihat
  /// catatan di checkIn().
  Future<void> confirmShiftClosing(List<ClosingCountItem> items) async {
    if (_token == null || shiftSessionId == null) return;
    const checkOutLatitude = 0.0;
    const checkOutLongitude = 0.0;
    const checkOutPhotoUrl = 'disabled-temporarily';
    await _api.confirmShiftClosing(
      _token!,
      shiftSessionId!,
      items
          .map(
            (i) => {
              'productId': i.productId,
              'actualQty': i.actualQty,
              if (i.reasonCode != null) 'reasonCode': i.reasonCode,
            },
          )
          .toList(),
      checkOutLatitude: checkOutLatitude,
      checkOutLongitude: checkOutLongitude,
      checkOutPhotoUrl: checkOutPhotoUrl,
    );
  }

  bool submittingReturn = false;

  /// Memanggil POST /returns. Server otomatis memakai seluruh sisa stok
  /// Booth sebagai qty return (BR-013), lalu mengeluarkannya dari
  /// booth_stocks supaya tidak bisa dijual lagi. Kita refresh stok
  /// sesudahnya supaya UI (harusnya 0 semua) tetap sinkron. `submittingReturn`
  /// dipakai UI untuk menonaktifkan tombol selama request berjalan supaya
  /// tidak submit dua kali (docs/11-notification-printing-offline.md §8).
  Future<void> submitReturn() async {
    if (_token == null || submittingReturn) return;
    submittingReturn = true;
    notifyListeners();
    try {
      await _api.createReturn(_token!);
      await refreshCatalog();
    } finally {
      submittingReturn = false;
      notifyListeners();
    }
  }
}

class CompletedSaleItem {
  CompletedSaleItem({
    required this.name,
    required this.qty,
    required this.price,
  });

  final String name;
  final int qty;
  final int price;
}

class CompletedSale {
  CompletedSale({
    required this.saleNo,
    required this.total,
    required this.paymentMethod,
    required this.items,
  });

  final String saleNo;
  final int total;
  final String paymentMethod;
  final List<CompletedSaleItem> items;
}

class SaleHistoryItem {
  SaleHistoryItem({
    this.productId,
    required this.productName,
    required this.qty,
  });

  final String? productId;
  final String productName;
  final int qty;
}

class SaleHistoryRecord {
  SaleHistoryRecord({
    required this.saleNo,
    required this.total,
    required this.paymentMethod,
    required this.status,
    required this.paidAt,
    required this.items,
  });

  final String saleNo;
  final int total;
  final String paymentMethod;
  final String status;
  final DateTime paidAt;
  final List<SaleHistoryItem> items;
}
