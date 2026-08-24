import '../../shared/models/booth_stock_item.dart';
import '../../shared/models/incoming_distribution.dart';
import '../../shared/models/product.dart';
import '../../shared/models/shift_summary.dart';

/// Data referensi dari docs/obbel-coffee-ai-docs/16-seed-dummy-data.md.
/// Dipakai sementara sebagai mock repository sebelum Backend API tersedia.
class MockCatalog {
  MockCatalog._();

  static const products = <Product>[
    Product(
      id: 'p-ori',
      sku: 'OBL-ORI',
      name: 'Original',
      category: ProductCategory.coffeeMilk,
      sellPrice: 8000,
    ),
    Product(
      id: 'p-bsg',
      sku: 'OBL-BSG',
      name: 'Brown Sugar',
      category: ProductCategory.coffeeMilk,
      sellPrice: 10000,
    ),
    Product(
      id: 'p-sc',
      sku: 'OBL-SC',
      name: 'Salted Caramel',
      category: ProductCategory.coffeeMilk,
      sellPrice: 10000,
    ),
    Product(
      id: 'p-alm',
      sku: 'OBL-ALM',
      name: 'Almond',
      category: ProductCategory.coffeeMilk,
      sellPrice: 10000,
    ),
    Product(
      id: 'p-bsc',
      sku: 'OBL-BSC',
      name: 'Butter Scotch',
      category: ProductCategory.coffeeMilk,
      sellPrice: 10000,
    ),
    Product(
      id: 'p-mat',
      sku: 'OBL-MAT',
      name: 'Matcha',
      category: ProductCategory.nonCoffee,
      sellPrice: 10000,
    ),
    Product(
      id: 'p-tar',
      sku: 'OBL-TAR',
      name: 'Taro',
      category: ProductCategory.nonCoffee,
      sellPrice: 10000,
    ),
    Product(
      id: 'p-cho',
      sku: 'OBL-CHO',
      name: 'Chocolate',
      category: ProductCategory.nonCoffee,
      sellPrice: 10000,
    ),
    Product(
      id: 'p-rv',
      sku: 'OBL-RV',
      name: 'Red Velvet',
      category: ProductCategory.nonCoffee,
      sellPrice: 10000,
    ),
    Product(
      id: 'p-amr',
      sku: 'OBL-AMR',
      name: 'Americano',
      category: ProductCategory.coffee,
      sellPrice: 10000,
    ),
  ];

  static Product byId(String id) =>
      products.firstWhere((p) => p.id == id, orElse: () => products.first);

  static List<BoothStockItem> initialBoothStock() {
    const qty = <String, int>{
      'p-ori': 25,
      'p-bsg': 20,
      'p-sc': 15,
      'p-mat': 18,
      'p-tar': 12,
      'p-cho': 8,
      'p-rv': 6,
      'p-amr': 10,
    };
    return qty.entries
        .map(
          (e) => BoothStockItem(
            product: byId(e.key),
            qtyOnHand: e.value,
            minimumQty: 5,
            criticalQty: 2,
          ),
        )
        .toList();
  }

  static IncomingDistribution pendingDistribution(String boothName) {
    return IncomingDistribution(
      id: 'dist-001',
      distributionNo: 'DIST-0001',
      boothName: boothName,
      shiftLabel: 'Shift 1 · 08.00 – 16.30',
      sentAt: DateTime.now().subtract(const Duration(minutes: 30)),
      items: const [
        IncomingDistributionItem(
          product: Product(
            id: 'p-ori',
            sku: 'OBL-ORI',
            name: 'Original',
            category: ProductCategory.coffeeMilk,
            sellPrice: 8000,
          ),
          qtySent: 10,
          qtyReceived: 10,
        ),
        IncomingDistributionItem(
          product: Product(
            id: 'p-bsg',
            sku: 'OBL-BSG',
            name: 'Brown Sugar',
            category: ProductCategory.coffeeMilk,
            sellPrice: 10000,
          ),
          qtySent: 5,
          qtyReceived: 5,
        ),
        IncomingDistributionItem(
          product: Product(
            id: 'p-mat',
            sku: 'OBL-MAT',
            name: 'Matcha',
            category: ProductCategory.nonCoffee,
            sellPrice: 10000,
          ),
          qtySent: 10,
          qtyReceived: 10,
        ),
        IncomingDistributionItem(
          product: Product(
            id: 'p-tar',
            sku: 'OBL-TAR',
            name: 'Taro',
            category: ProductCategory.nonCoffee,
            sellPrice: 10000,
          ),
          qtySent: 5,
          qtyReceived: 5,
        ),
      ],
    );
  }

  static ShiftSummary shiftSummary(String boothName) {
    final now = DateTime.now();
    final start = DateTime(now.year, now.month, now.day, 8);
    final end = DateTime(now.year, now.month, now.day, 16, 30);
    return ShiftSummary(
      shiftSessionId: 'shift-001',
      shiftLabel: 'Shift 1',
      boothName: boothName,
      startTime: start,
      endTime: end,
      status: ShiftStatus.open,
      omzetToday: 0,
      cupSoldToday: 0,
      transactionCount: 0,
      averagePerTransaction: 0,
    );
  }
}
