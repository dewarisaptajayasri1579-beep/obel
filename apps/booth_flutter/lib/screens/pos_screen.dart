import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../app_state.dart';
import 'history_screen.dart';

class PosScreen extends StatefulWidget {
  const PosScreen({super.key});

  @override
  State<PosScreen> createState() => _PosScreenState();
}

class _PosScreenState extends State<PosScreen> {
  String _selectedCategory = 'Semua';
  String _searchQuery = '';

  int _cartQuantityForProduct(dynamic product, dynamic cart) {
    final item = cart.where((e) => e.product == product).toList();
    if (item.isEmpty) return 0;
    return item.first.quantity;
  }

  String _formatPrice(dynamic price) {
    final value = price.toString();
    final digits = value.replaceAll(RegExp(r'[^0-9]'), '');

    if (digits.isEmpty) return '0';

    final buffer = StringBuffer();

    for (int i = 0; i < digits.length; i++) {
      final positionFromEnd = digits.length - i;

      buffer.write(digits[i]);

      if (positionFromEnd > 1 && positionFromEnd % 3 == 1) {
        buffer.write('.');
      }
    }

    return buffer.toString();
  }

  IconData _iconForCategory(dynamic category) {
    switch (category) {
      case 'Coffee':
        return Icons.coffee_outlined;
      case 'Non Coffee':
        return Icons.local_drink_outlined;
      case 'Coffee Milk':
      default:
        return Icons.local_cafe_outlined;
    }
  }

  @override
  Widget build(BuildContext context) {
    final appState = context.watch<AppState>();
    final products = appState.catalog;
    final cart = appState.cart;
    final cartCount = appState.cartCount;
    final cartTotal = appState.cartTotal;

    final filteredProducts = products.where((product) {
      final matchesCategory = _selectedCategory == 'Semua' ||
          product.category == _selectedCategory;

      final matchesSearch = _searchQuery.isEmpty ||
          product.name.toLowerCase().contains(_searchQuery.toLowerCase());

      return matchesCategory && matchesSearch;
    }).toList();

    final outOfStockCount = products
        .where((product) => appState.stockQtyFor(product.id) <= 0)
        .length;

    return Scaffold(
      backgroundColor: const Color(0xFFF6F9F8),
      body: SafeArea(
        child: Column(
          children: [
            Container(
              width: double.infinity,
              height: 64,
              color: const Color(0xFF07563D),
              padding: const EdgeInsets.symmetric(horizontal: 18),
              child: Row(
                children: [
                  const Expanded(
                    child: Text(
                      'Jual / POS',
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: 20,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ),
                  GestureDetector(
                    onTap: () {
                      Navigator.push(
                        context,
                        MaterialPageRoute(
                          builder: (_) => const HistoryScreen(),
                        ),
                      );
                    },
                    child: Container(
                      width: 42,
                      height: 42,
                      decoration: BoxDecoration(
                        color: const Color(0xFF0B684A),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(
                          color: const Color(0xFF16805E),
                        ),
                      ),
                      child: const Icon(
                        Icons.history,
                        color: Color(0xFFB8EEDB),
                        size: 23,
                      ),
                    ),
                  ),
                ],
              ),
            ),
            Container(
              width: double.infinity,
              color: Colors.white,
              padding: const EdgeInsets.fromLTRB(20, 16, 20, 12),
              child: Column(
                children: [
                  Container(
                    height: 52,
                    decoration: BoxDecoration(
                      color: const Color(0xFFF1F5F7),
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(
                        color: const Color(0xFFDCE5EA),
                      ),
                    ),
                    child: TextField(
                      onChanged: (value) {
                        setState(() {
                          _searchQuery = value.trim();
                        });
                      },
                      decoration: InputDecoration(
                        hintText: 'Cari kopi, susu, non-coffee...',
                        hintStyle: const TextStyle(
                          color: Color(0xFF8FA1B5),
                          fontSize: 15,
                          fontWeight: FontWeight.w500,
                        ),
                        prefixIcon: const Icon(
                          Icons.search,
                          color: Color(0xFF8FA1B5),
                          size: 24,
                        ),
                        suffixIcon: _searchQuery.isNotEmpty
                            ? GestureDetector(
                                onTap: () {
                                  setState(() {
                                    _searchQuery = '';
                                  });
                                },
                                child: const Icon(
                                  Icons.close,
                                  color: Color(0xFF8FA1B5),
                                  size: 22,
                                ),
                              )
                            : const Icon(
                                Icons.tune,
                                color: Color(0xFF8FA1B5),
                                size: 22,
                              ),
                        border: InputBorder.none,
                        contentPadding: const EdgeInsets.symmetric(
                          vertical: 14,
                          horizontal: 4,
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(height: 12),
                  SizedBox(
                    height: 40,
                    child: SingleChildScrollView(
                      scrollDirection: Axis.horizontal,
                      child: Row(
                        children: [
                          ...['Semua', 'Coffee Milk', 'Non Coffee', 'Coffee']
                              .map((cat) {
                            final isSelected = _selectedCategory == cat;

                            return Padding(
                              padding: const EdgeInsets.only(right: 8),
                              child: GestureDetector(
                                onTap: () {
                                  setState(() {
                                    _selectedCategory = cat;
                                  });
                                },
                                child: Container(
                                  padding: const EdgeInsets.symmetric(
                                    horizontal: 16,
                                    vertical: 9,
                                  ),
                                  decoration: BoxDecoration(
                                    color: isSelected
                                        ? const Color(0xFF07563D)
                                        : Colors.white,
                                    borderRadius: BorderRadius.circular(20),
                                    border: Border.all(
                                      color: isSelected
                                          ? const Color(0xFF07563D)
                                          : const Color(0xFFDCE4EA),
                                    ),
                                  ),
                                  child: Row(
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      if (isSelected) ...[
                                        const Icon(
                                          Icons.check,
                                          color: Colors.white,
                                          size: 15,
                                        ),
                                        const SizedBox(width: 6),
                                      ],
                                      Text(
                                        cat == 'Semua'
                                            ? 'Semua (${products.length})'
                                            : cat,
                                        style: TextStyle(
                                          color: isSelected
                                              ? Colors.white
                                              : const Color(0xFF35445A),
                                          fontSize: 13,
                                          fontWeight: FontWeight.w700,
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              ),
                            );
                          }),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ),
            Container(
              color: const Color(0xFFF6F9F8),
              padding: const EdgeInsets.fromLTRB(20, 14, 20, 8),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text(
                    'PILIH MENU CEPAT',
                    style: TextStyle(
                      color: Color(0xFF667991),
                      fontSize: 13,
                      fontWeight: FontWeight.w700,
                      letterSpacing: 0.2,
                    ),
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 10,
                      vertical: 6,
                    ),
                    decoration: BoxDecoration(
                      color: const Color(0xFFFDEEEE),
                      borderRadius: BorderRadius.circular(9),
                      border: Border.all(
                        color: const Color(0xFFF6D6D6),
                      ),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(
                          Icons.warning_amber_rounded,
                          color: Color(0xFFE0333B),
                          size: 16,
                        ),
                        const SizedBox(width: 4),
                        Text(
                          '$outOfStockCount Menu Habis',
                          style: const TextStyle(
                            color: Color(0xFFE0333B),
                            fontSize: 12,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            Expanded(
              child: filteredProducts.isEmpty
                  ? const Center(
                      child: Text(
                        'Menu tidak ditemukan',
                        style: TextStyle(
                          color: Color(0xFF667991),
                          fontSize: 14,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    )
                  : GridView.builder(
                      padding: const EdgeInsets.fromLTRB(20, 4, 20, 12),
                      itemCount: filteredProducts.length,
                      gridDelegate:
                          const SliverGridDelegateWithFixedCrossAxisCount(
                        crossAxisCount: 3,
                        crossAxisSpacing: 10,
                        mainAxisSpacing: 10,
                        childAspectRatio: 0.68,
                      ),
                      itemBuilder: (context, index) {
                        final product = filteredProducts[index];
                        final quantity =
                            _cartQuantityForProduct(product, cart);
                        final isSelected = quantity > 0;
                        final stockQty =
                            appState.stockQtyFor(product.id);
                        final isOutOfStock = stockQty <= 0;

                        return GestureDetector(
                          onTap: isOutOfStock
                              ? null
                              : () => appState.addToCart(product),
                          child: Container(
                            decoration: BoxDecoration(
                              color: isOutOfStock
                                  ? const Color(0xFFF1F3F4)
                                  : Colors.white,
                              borderRadius: BorderRadius.circular(18),
                              border: Border.all(
                                color: isOutOfStock
                                    ? const Color(0xFFD9DEE1)
                                    : isSelected
                                        ? const Color(0xFF07563D)
                                        : const Color(0xFFE2E9ED),
                                width:
                                    isSelected && !isOutOfStock ? 2 : 1,
                              ),
                              boxShadow: [
                                BoxShadow(
                                  color: Colors.black.withValues(
                                    alpha: isOutOfStock ? 0.02 : 0.04,
                                  ),
                                  blurRadius: 5,
                                  offset: const Offset(0, 2),
                                ),
                              ],
                            ),
                            padding: const EdgeInsets.all(10),
                            child: Column(
                              crossAxisAlignment:
                                  CrossAxisAlignment.start,
                              children: [
                                Expanded(
                                  child: Stack(
                                    children: [
                                      Container(
                                        width: double.infinity,
                                        decoration: BoxDecoration(
                                          color: isOutOfStock
                                              ? const Color(0xFFE7EBED)
                                              : isSelected
                                                  ? const Color(0xFFEEF8F4)
                                                  : const Color(0xFFF7F9FA),
                                          borderRadius:
                                              BorderRadius.circular(14),
                                          border: Border.all(
                                            color: isOutOfStock
                                                ? const Color(0xFFDCE1E4)
                                                : const Color(0xFFE9EFF2),
                                          ),
                                        ),
                                        child: Center(
                                          child: product.imageUrl != null
                                              ? ClipRRect(
                                                  borderRadius:
                                                      BorderRadius.circular(14),
                                                  child: Image.network(
                                                    product.imageUrl!,
                                                    width: double.infinity,
                                                    height: double.infinity,
                                                    fit: BoxFit.cover,
                                                    errorBuilder: (
                                                      context,
                                                      error,
                                                      stackTrace,
                                                    ) => Icon(
                                                      _iconForCategory(
                                                        product.category,
                                                      ),
                                                      color: isOutOfStock
                                                          ? const Color(
                                                              0xFF9AA5AB,
                                                            )
                                                          : const Color(
                                                              0xFF07563D,
                                                            ),
                                                      size: 34,
                                                    ),
                                                  ),
                                                )
                                              : Icon(
                                                  _iconForCategory(
                                                    product.category,
                                                  ),
                                                  color: isOutOfStock
                                                      ? const Color(0xFF9AA5AB)
                                                      : const Color(0xFF07563D),
                                                  size: 34,
                                                ),
                                        ),
                                      ),
                                      if (isOutOfStock)
                                        Positioned(
                                          top: 6,
                                          left: 6,
                                          child: Container(
                                            padding:
                                                const EdgeInsets.symmetric(
                                              horizontal: 8,
                                              vertical: 4,
                                            ),
                                            decoration: BoxDecoration(
                                              color:
                                                  const Color(0xFFE0333B),
                                              borderRadius:
                                                  BorderRadius.circular(8),
                                            ),
                                            child: const Text(
                                              'Habis',
                                              style: TextStyle(
                                                color: Colors.white,
                                                fontSize: 10,
                                                fontWeight: FontWeight.w800,
                                              ),
                                            ),
                                          ),
                                        ),
                                      if (isSelected && !isOutOfStock)
                                        Positioned(
                                          top: 6,
                                          right: 6,
                                          child: Container(
                                            width: 24,
                                            height: 24,
                                            decoration:
                                                const BoxDecoration(
                                              color: Color(0xFF07563D),
                                              shape: BoxShape.circle,
                                            ),
                                            child: Center(
                                              child: Text(
                                                '$quantity',
                                                style: const TextStyle(
                                                  color: Colors.white,
                                                  fontSize: 12,
                                                  fontWeight:
                                                      FontWeight.w700,
                                                ),
                                              ),
                                            ),
                                          ),
                                        ),
                                    ],
                                  ),
                                ),
                                const SizedBox(height: 8),
                                SizedBox(
                                  height: 32,
                                  child: Text(
                                    product.name,
                                    style: TextStyle(
                                      color: isOutOfStock
                                          ? const Color(0xFF8B9499)
                                          : const Color(0xFF172033),
                                      fontSize: 13,
                                      fontWeight: FontWeight.w700,
                                      height: 1.15,
                                    ),
                                    maxLines: 2,
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                ),
                                const SizedBox(height: 4),
                                Text(
                                  'Rp ${_formatPrice(product.price)}',
                                  style: TextStyle(
                                    color: isOutOfStock
                                        ? const Color(0xFF929B9F)
                                        : isSelected
                                            ? const Color(0xFF07563D)
                                            : const Color(0xFF263449),
                                    fontSize: 13,
                                    fontWeight: FontWeight.w700,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        );
                      },
                    ),
            ),
            if (cart.isNotEmpty)
              SafeArea(
                top: false,
                child: Container(
                  margin: const EdgeInsets.fromLTRB(20, 0, 20, 10),
                  padding: const EdgeInsets.fromLTRB(12, 10, 10, 10),
                  decoration: BoxDecoration(
                    color: const Color(0xFF004832),
                    borderRadius: BorderRadius.circular(20),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withValues(alpha: 0.12),
                        blurRadius: 10,
                        offset: const Offset(0, 4),
                      ),
                    ],
                  ),
                  child: Row(
                    children: [
                      Container(
                        width: 44,
                        height: 44,
                        decoration: BoxDecoration(
                          color: const Color(0xFF075F43),
                          borderRadius: BorderRadius.circular(14),
                          border: Border.all(
                            color: const Color(0xFF0B7A55),
                          ),
                        ),
                        child: Stack(
                          clipBehavior: Clip.none,
                          children: [
                            const Center(
                              child: Icon(
                                Icons.shopping_bag_outlined,
                                color: Color(0xFF66DCAF),
                                size: 22,
                              ),
                            ),
                            Positioned(
                              top: -6,
                              right: -6,
                              child: Container(
                                width: 22,
                                height: 22,
                                decoration: const BoxDecoration(
                                  color: Color(0xFF29D39A),
                                  shape: BoxShape.circle,
                                ),
                                child: Center(
                                  child: Text(
                                    '$cartCount',
                                    style: const TextStyle(
                                      color: Color(0xFF064832),
                                      fontSize: 11,
                                      fontWeight: FontWeight.w800,
                                    ),
                                  ),
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            const Text(
                              'Cup Pesanan',
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: TextStyle(
                                color: Color(0xFF9BDDC5),
                                fontSize: 13,
                                fontWeight: FontWeight.w500,
                              ),
                            ),
                            const SizedBox(height: 2),
                            Text(
                              'Rp ${_formatPrice(cartTotal)}',
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(
                                color: Colors.white,
                                fontSize: 18,
                                fontWeight: FontWeight.w800,
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(width: 8),
                      GestureDetector(
                        onTap: () {
                          Navigator.pushNamed(context, '/checkout');
                        },
                        child: Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 18,
                            vertical: 13,
                          ),
                          decoration: BoxDecoration(
                            color: const Color(0xFF35D39D),
                            borderRadius: BorderRadius.circular(14),
                          ),
                          child: const Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Text(
                                'Bayar',
                                style: TextStyle(
                                  color: Color(0xFF063D2C),
                                  fontSize: 15,
                                  fontWeight: FontWeight.w800,
                                ),
                              ),
                              SizedBox(width: 6),
                              Icon(
                                Icons.arrow_forward_rounded,
                                color: Color(0xFF063D2C),
                                size: 20,
                              ),
                            ],
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}