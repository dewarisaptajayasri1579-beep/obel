import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../shared/models/booth_stock_item.dart';
import '../../shared/models/cart_item.dart';
import '../../shared/models/incoming_distribution.dart';
import '../../shared/models/product.dart';
import '../../shared/models/shift_summary.dart';
import '../mock/mock_data.dart';

class AppDataState {
  const AppDataState({
    required this.staffName,
    required this.boothName,
    required this.loggedIn,
    required this.boothStock,
    required this.cart,
    required this.pendingDistribution,
    required this.shift,
  });

  final String staffName;
  final String boothName;
  final bool loggedIn;
  final List<BoothStockItem> boothStock;
  final List<CartItem> cart;
  final IncomingDistribution? pendingDistribution;
  final ShiftSummary shift;

  int get cartTotal => cart.fold(0, (sum, item) => sum + item.lineTotal);
  int get cartCupCount => cart.fold(0, (sum, item) => sum + item.qty);

  int stockQtyFor(String productId) {
    for (final item in boothStock) {
      if (item.product.id == productId) return item.qtyOnHand;
    }
    return 0;
  }

  int cartQtyFor(String productId) {
    for (final item in cart) {
      if (item.product.id == productId) return item.qty;
    }
    return 0;
  }

  AppDataState copyWith({
    String? staffName,
    String? boothName,
    bool? loggedIn,
    List<BoothStockItem>? boothStock,
    List<CartItem>? cart,
    IncomingDistribution? pendingDistribution,
    bool clearPendingDistribution = false,
    ShiftSummary? shift,
  }) {
    return AppDataState(
      staffName: staffName ?? this.staffName,
      boothName: boothName ?? this.boothName,
      loggedIn: loggedIn ?? this.loggedIn,
      boothStock: boothStock ?? this.boothStock,
      cart: cart ?? this.cart,
      pendingDistribution: clearPendingDistribution
          ? null
          : (pendingDistribution ?? this.pendingDistribution),
      shift: shift ?? this.shift,
    );
  }
}

/// Mock in-memory repository. Semua mutation stok nantinya wajib
/// digantikan pemanggilan Backend API (bukan update state lokal saja)
/// begitu backend tersedia — lihat AGENTS.md.
class AppDataController extends Notifier<AppDataState> {
  @override
  AppDataState build() {
    const boothName = 'Booth Gallery Pandanaran';
    return AppDataState(
      staffName: 'Kak Rina',
      boothName: boothName,
      loggedIn: false,
      boothStock: MockCatalog.initialBoothStock(),
      cart: const [],
      pendingDistribution: MockCatalog.pendingDistribution(boothName),
      shift: MockCatalog.shiftSummary(boothName),
    );
  }

  void login() {
    state = state.copyWith(loggedIn: true);
  }

  void logout() {
    state = state.copyWith(loggedIn: false, cart: const []);
  }

  void receiveDistribution(List<IncomingDistributionItem> confirmedItems) {
    final updated = [...state.boothStock];
    for (final item in confirmedItems) {
      final idx = updated.indexWhere((s) => s.product.id == item.product.id);
      if (idx >= 0) {
        updated[idx] = updated[idx]
            .copyWith(qtyOnHand: updated[idx].qtyOnHand + item.qtyReceived);
      } else {
        updated.add(
          BoothStockItem(
            product: item.product,
            qtyOnHand: item.qtyReceived,
            minimumQty: 5,
            criticalQty: 2,
          ),
        );
      }
    }
    state = state.copyWith(
      boothStock: updated,
      clearPendingDistribution: true,
    );
  }

  void addToCart(Product product) {
    final available = state.stockQtyFor(product.id);
    final currentQty = state.cartQtyFor(product.id);
    if (currentQty >= available) return;

    final idx = state.cart.indexWhere((c) => c.product.id == product.id);
    if (idx >= 0) {
      final updated = [...state.cart];
      updated[idx] = updated[idx].copyWith(qty: updated[idx].qty + 1);
      state = state.copyWith(cart: updated);
    } else {
      state = state.copyWith(
        cart: [...state.cart, CartItem(product: product, qty: 1)],
      );
    }
  }

  void updateCartQty(Product product, int qty) {
    if (qty <= 0) {
      state = state.copyWith(
        cart: state.cart.where((c) => c.product.id != product.id).toList(),
      );
      return;
    }
    final available = state.stockQtyFor(product.id);
    final clamped = qty > available ? available : qty;
    final updated = state.cart
        .map((c) => c.product.id == product.id ? c.copyWith(qty: clamped) : c)
        .toList();
    state = state.copyWith(cart: updated);
  }

  void clearCart() {
    state = state.copyWith(cart: const []);
  }

  int checkout() {
    final total = state.cartTotal;
    final cupCount = state.cartCupCount;

    final updatedStock = [...state.boothStock];
    for (final item in state.cart) {
      final idx = updatedStock.indexWhere((s) => s.product.id == item.product.id);
      if (idx >= 0) {
        updatedStock[idx] = updatedStock[idx]
            .copyWith(qtyOnHand: updatedStock[idx].qtyOnHand - item.qty);
      }
    }

    final shift = state.shift;
    final newOmzet = shift.omzetToday + total;
    final newTxCount = shift.transactionCount + 1;
    final updatedShift = ShiftSummary(
      shiftSessionId: shift.shiftSessionId,
      shiftLabel: shift.shiftLabel,
      boothName: shift.boothName,
      startTime: shift.startTime,
      endTime: shift.endTime,
      status: shift.status,
      omzetToday: newOmzet,
      cupSoldToday: shift.cupSoldToday + cupCount,
      transactionCount: newTxCount,
      averagePerTransaction: (newOmzet / newTxCount).round(),
    );

    state = state.copyWith(
      boothStock: updatedStock,
      cart: const [],
      shift: updatedShift,
    );
    return total;
  }

  void applyClosingCount(Map<String, int> actualCountByProductId) {
    final updated = state.boothStock.map((item) {
      final actual = actualCountByProductId[item.product.id];
      if (actual == null) return item;
      return item.copyWith(qtyOnHand: actual);
    }).toList();

    final shift = state.shift;
    final closedShift = ShiftSummary(
      shiftSessionId: shift.shiftSessionId,
      shiftLabel: shift.shiftLabel,
      boothName: shift.boothName,
      startTime: shift.startTime,
      endTime: shift.endTime,
      status: ShiftStatus.closed,
      omzetToday: shift.omzetToday,
      cupSoldToday: shift.cupSoldToday,
      transactionCount: shift.transactionCount,
      averagePerTransaction: shift.averagePerTransaction,
    );

    state = state.copyWith(boothStock: updated, shift: closedShift);
  }
}

final appDataProvider =
    NotifierProvider<AppDataController, AppDataState>(AppDataController.new);
