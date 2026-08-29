import 'package:flutter/foundation.dart';

import 'models.dart';

const _minimumQty = 25;
const _criticalQty = 10;

String _statusFor(int qty) {
  if (qty <= 0) return 'Habis';
  if (qty <= _criticalQty) return 'Kritis';
  if (qty <= _minimumQty) return 'Menipis';
  return 'Aman';
}

/// State bersama seluruh layar Petugas Booth (Beranda, POS, Stok, Shift,
/// Terima Stok). Dipakai sebagai pengganti sementara Backend API — setiap
/// mutation di sini (checkout, receiveInbound) adalah tempat yang tepat untuk
/// nanti diganti pemanggilan service/RPC atomik + stock_movements.
class AppState extends ChangeNotifier {
  AppState()
      : catalog = const [
          Product(id: '1', name: 'Original', price: 8000, category: 'Coffee Milk', imagePath: ''),
          Product(id: '2', name: 'Brown Sugar', price: 10000, category: 'Coffee Milk', imagePath: ''),
          Product(id: '3', name: 'Salted Caramel', price: 10000, category: 'Coffee Milk', imagePath: ''),
          Product(id: '4', name: 'Matcha', price: 10000, category: 'Non Coffee', imagePath: ''),
          Product(id: '5', name: 'Taro', price: 10000, category: 'Non Coffee', imagePath: ''),
          Product(id: '6', name: 'Chocolate', price: 10000, category: 'Non Coffee', imagePath: ''),
          Product(id: '7', name: 'Red Velvet', price: 10000, category: 'Non Coffee', imagePath: ''),
          Product(id: '8', name: 'Americano', price: 10000, category: 'Coffee', imagePath: ''),
        ] {
    stock = [
      BoothStock(product: catalog[0], currentQty: 120, status: _statusFor(120)),
      BoothStock(product: catalog[1], currentQty: 80, status: _statusFor(80)),
      BoothStock(product: catalog[2], currentQty: 60, status: _statusFor(60)),
      BoothStock(product: catalog[3], currentQty: 70, status: _statusFor(70)),
      BoothStock(product: catalog[4], currentQty: 60, status: _statusFor(60)),
      BoothStock(product: catalog[5], currentQty: 50, status: _statusFor(50)),
      BoothStock(product: catalog[6], currentQty: 40, status: _statusFor(40)),
      BoothStock(product: catalog[7], currentQty: 30, status: _statusFor(30)),
    ];
    pendingInbound = [
      InboundItem(product: catalog[0], expectedQty: 10, actualQty: 10),
      InboundItem(product: catalog[1], expectedQty: 5, actualQty: 5),
      InboundItem(product: catalog[3], expectedQty: 10, actualQty: 10),
      InboundItem(product: catalog[4], expectedQty: 5, actualQty: 5),
    ];
    soldQtyByProductId = {'2': 30, '1': 30, '4': 18};
  }

  final String staffName = 'Kak Rina';
  final String boothName = 'Booth Gallery Pandanaran';
  final String shiftLabel = 'SHIFT 1 AKTIF';
  final String shiftTime = '08.00 - 16.30';

  final List<Product> catalog;
  late List<BoothStock> stock;
  late List<InboundItem>? pendingInbound;
  final List<CartItem> cart = [];
  late Map<String, int> soldQtyByProductId;

  int omzetToday = 1250000;
  int cupSoldToday = 125;
  int transactionCount = 32;

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
      catalog.firstWhere((p) => p.id == productId).name;

  int stockQtyFor(String productId) {
    final match = stock.where((s) => s.product.id == productId);
    return match.isEmpty ? 0 : match.first.currentQty;
  }

  void addToCart(Product product) {
    final available = stockQtyFor(product.id);
    final inCart = cart.where((c) => c.product.id == product.id);
    final currentQty = inCart.isEmpty ? 0 : inCart.first.quantity;
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

  /// Mengurangi stok sesuai isi cart, mencatat omzet/cup/transaksi, lalu
  /// mengosongkan cart. Mengembalikan total yang dibayar.
  int checkout() {
    final total = cartTotal;
    final cupCount = cartCount;

    for (final item in cart) {
      final idx = stock.indexWhere((s) => s.product.id == item.product.id);
      if (idx >= 0) {
        stock[idx].currentQty -= item.quantity;
        stock[idx] = BoothStock(
          product: stock[idx].product,
          currentQty: stock[idx].currentQty,
          status: _statusFor(stock[idx].currentQty),
        );
      }
      soldQtyByProductId.update(
        item.product.id,
        (v) => v + item.quantity,
        ifAbsent: () => item.quantity,
      );
    }

    omzetToday += total;
    cupSoldToday += cupCount;
    transactionCount += 1;
    cart.clear();
    notifyListeners();
    return total;
  }

  void updateInboundQty(InboundItem item, int qty) {
    if (qty < 0) return;
    item.actualQty = qty;
    notifyListeners();
  }

  /// Menambahkan qty yang benar-benar diterima ke stok Booth, lalu
  /// menghapus daftar stok masuk (dianggap sudah diterima).
  void receiveInbound() {
    final items = pendingInbound;
    if (items == null) return;
    for (final item in items) {
      final idx = stock.indexWhere((s) => s.product.id == item.product.id);
      if (idx >= 0) {
        stock[idx].currentQty += item.actualQty;
        stock[idx] = BoothStock(
          product: stock[idx].product,
          currentQty: stock[idx].currentQty,
          status: _statusFor(stock[idx].currentQty),
        );
      }
    }
    pendingInbound = null;
    notifyListeners();
  }
}
