enum ProductCategory { coffeeMilk, nonCoffee, coffee }

extension ProductCategoryLabel on ProductCategory {
  String get label {
    switch (this) {
      case ProductCategory.coffeeMilk:
        return 'Coffee Milk';
      case ProductCategory.nonCoffee:
        return 'Non Coffee';
      case ProductCategory.coffee:
        return 'Coffee';
    }
  }
}

class Product {
  const Product({
    required this.id,
    required this.sku,
    required this.name,
    required this.category,
    required this.sellPrice,
    this.active = true,
  });

  final String id;
  final String sku;
  final String name;
  final ProductCategory category;
  final int sellPrice;
  final bool active;
}
