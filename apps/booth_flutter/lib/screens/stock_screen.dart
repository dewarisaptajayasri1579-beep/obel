import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../api_client.dart';
import '../app_state.dart';
import '../theme.dart';

class StockScreen extends StatefulWidget {
  const StockScreen({super.key});

  @override
  State<StockScreen> createState() => _StockScreenState();
}

class _StockScreenState extends State<StockScreen> {
  String _filterType = 'Semua';
  int _restockIncrement = 5;
  String? _selectedProductId;
  bool _requesting = false;

  Future<void> _submitRestock(String productName) async {
    final appState = context.read<AppState>();
    final product = appState.stock.firstWhere((s) => s.product.id == _selectedProductId).product;
    setState(() => _requesting = true);
    try {
      await appState.requestRestock(product, _restockIncrement);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Permintaan restock $productName +$_restockIncrement cup terkirim!'),
          backgroundColor: ObbelTheme.primaryDark,
        ),
      );
    } on ApiException catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(e.message), backgroundColor: ObbelTheme.accentRed),
      );
    } finally {
      if (mounted) setState(() => _requesting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final stocks = context.watch<AppState>().stock;
    final selectedMatches = stocks.where((s) => s.product.id == _selectedProductId);
    final selectedProduct = selectedMatches.isEmpty ? null : selectedMatches.first.product;
    return Scaffold(
      backgroundColor: ObbelTheme.backgroundLight,
      appBar: AppBar(
        title: const Text('Stok Booth'),
        actions: [
          IconButton(
            icon: const Icon(Icons.search),
            onPressed: () {},
          )
        ],
      ),
      body: Column(
        children: [
          // Filter Chips
          Container(
            color: Colors.white,
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            child: Row(
              children: ['Semua', 'Bahan Baku', 'Susu'].map((filter) {
                final isSelected = _filterType == filter;
                return Padding(
                  padding: const EdgeInsets.only(right: 8.0),
                  child: ChoiceChip(
                    label: Text(filter),
                    selected: isSelected,
                    selectedColor: ObbelTheme.primaryDark,
                    backgroundColor: Colors.white,
                    labelStyle: TextStyle(
                      color: isSelected ? Colors.white : ObbelTheme.textDark,
                      fontWeight: FontWeight.bold,
                      fontSize: 12,
                    ),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(8),
                      side: BorderSide(
                        color: isSelected ? Colors.transparent : Colors.grey.shade300,
                      ),
                    ),
                    onSelected: (selected) {
                      if (selected) {
                        setState(() {
                          _filterType = filter;
                        });
                      }
                    },
                  ),
                );
              }).toList(),
            ),
          ),
          const SizedBox(height: 8),

          // Headers
          const Padding(
            padding: EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text('Produk', style: TextStyle(fontWeight: FontWeight.bold, color: ObbelTheme.textLight)),
                Row(
                  children: [
                    Text('Stok (cup)', style: TextStyle(fontWeight: FontWeight.bold, color: ObbelTheme.textLight)),
                    SizedBox(width: 32),
                    Text('Status', style: TextStyle(fontWeight: FontWeight.bold, color: ObbelTheme.textLight)),
                  ],
                ),
              ],
            ),
          ),

          // Stock Items List
          Expanded(
            child: ListView.builder(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              itemCount: stocks.length,
              itemBuilder: (context, index) {
                final stock = stocks[index];
                final isSelected = stock.product.id == _selectedProductId;
                return GestureDetector(
                  onTap: () => setState(() => _selectedProductId = stock.product.id),
                  child: Container(
                  margin: const EdgeInsets.only(bottom: 8),
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(12),
                    border: isSelected
                        ? Border.all(color: ObbelTheme.primaryDark, width: 1.5)
                        : null,
                  ),
                  child: Row(
                    children: [
                      // Drink Icon
                      Container(
                        padding: const EdgeInsets.all(8),
                        decoration: BoxDecoration(
                          color: ObbelTheme.backgroundLight,
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: const Icon(Icons.coffee, color: ObbelTheme.primaryDark),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Text(
                          stock.product.name,
                          style: const TextStyle(
                            fontWeight: FontWeight.bold,
                            color: ObbelTheme.textDark,
                            fontSize: 14,
                          ),
                        ),
                      ),
                      Text(
                        '${stock.currentQty} cup',
                        style: const TextStyle(
                          fontWeight: FontWeight.bold,
                          color: ObbelTheme.textDark,
                          fontSize: 14,
                        ),
                      ),
                      const SizedBox(width: 24),
                      Builder(builder: (context) {
                        final color = switch (stock.status) {
                          'Habis' => ObbelTheme.accentRed,
                          'Kritis' => ObbelTheme.accentOrange,
                          'Menipis' => const Color(0xFFC79A00),
                          _ => ObbelTheme.primaryMedium,
                        };
                        return Container(
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                          decoration: BoxDecoration(
                            color: color.withValues(alpha: 0.12),
                            borderRadius: BorderRadius.circular(20),
                          ),
                          child: Text(
                            stock.status,
                            style: TextStyle(
                              color: color,
                              fontWeight: FontWeight.bold,
                              fontSize: 11,
                            ),
                          ),
                        );
                      })
                    ],
                  ),
                  ),
                );
              },
            ),
          ),

          // Restock Quick Tools Panel
          Container(
            padding: const EdgeInsets.all(16),
            decoration: const BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.only(
                topLeft: Radius.circular(16),
                topRight: Radius.circular(16),
              ),
            ),
            child: SafeArea(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Row(
                    children: [
                      const Text(
                        'Kelola Restock Cepat',
                        style: TextStyle(
                          fontWeight: FontWeight.bold,
                          fontSize: 13,
                          color: ObbelTheme.textLight,
                        ),
                      ),
                      if (selectedProduct != null) ...[
                        const SizedBox(width: 6),
                        Text(
                          '· ${selectedProduct.name}',
                          style: const TextStyle(
                            fontWeight: FontWeight.bold,
                            fontSize: 13,
                            color: ObbelTheme.primaryDark,
                          ),
                        ),
                      ],
                    ],
                  ),
                  if (selectedProduct == null)
                    const Padding(
                      padding: EdgeInsets.only(top: 4),
                      child: Text(
                        'Tap salah satu produk di atas untuk memilih.',
                        style: TextStyle(fontSize: 12, color: ObbelTheme.textLight),
                      ),
                    ),
                  const SizedBox(height: 10),
                  Row(
                    children: [5, 10, 15, 20].map((val) {
                      final isSelected = _restockIncrement == val;
                      return Expanded(
                        child: Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 4.0),
                          child: GestureDetector(
                            onTap: () {
                              setState(() {
                                _restockIncrement = val;
                              });
                            },
                            child: Container(
                              alignment: Alignment.center,
                              padding: const EdgeInsets.symmetric(vertical: 8),
                              decoration: BoxDecoration(
                                color: isSelected ? ObbelTheme.primaryDark : ObbelTheme.backgroundLight,
                                borderRadius: BorderRadius.circular(8),
                                border: Border.all(
                                  color: isSelected ? Colors.transparent : Colors.grey.shade300,
                                ),
                              ),
                              child: Text(
                                '+$val',
                                style: TextStyle(
                                  fontWeight: FontWeight.bold,
                                  color: isSelected ? Colors.white : ObbelTheme.textDark,
                                ),
                              ),
                            ),
                          ),
                        ),
                      );
                    }).toList(),
                  ),
                  const SizedBox(height: 14),
                  ElevatedButton(
                    onPressed: (selectedProduct == null || _requesting)
                        ? null
                        : () => _submitRestock(selectedProduct.name),
                    child: _requesting
                        ? const SizedBox(
                            width: 22,
                            height: 22,
                            child: CircularProgressIndicator(
                              color: Colors.white,
                              strokeWidth: 2.5,
                            ),
                          )
                        : const Text('MINTA RESTOCK'),
                  ),
                  const SizedBox(height: 8),
                  OutlinedButton(
                    style: OutlinedButton.styleFrom(
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                      side: BorderSide(color: Colors.grey.shade300),
                    ),
                    onPressed: () {},
                    child: const Text(
                      'RIWAYAT STOK',
                      style: TextStyle(
                        color: ObbelTheme.textDark,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  )
                ],
              ),
            ),
          )
        ],
      ),
    );
  }
}
