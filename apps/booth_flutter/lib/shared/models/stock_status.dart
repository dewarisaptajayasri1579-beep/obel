import 'package:flutter/material.dart';

import '../../core/theme/app_colors.dart';

/// Sesuai BR-007 08-business-rules.md:
/// `HABIS qty<=0, KRITIS 0<qty<=critical, MENIPIS critical<qty<=minimum, AMAN qty>minimum`.
enum StockStatus { aman, menipis, kritis, habis }

StockStatus resolveStockStatus({
  required int qty,
  required int minimumQty,
  required int criticalQty,
}) {
  if (qty <= 0) return StockStatus.habis;
  if (qty <= criticalQty) return StockStatus.kritis;
  if (qty <= minimumQty) return StockStatus.menipis;
  return StockStatus.aman;
}

extension StockStatusLabel on StockStatus {
  String get label {
    switch (this) {
      case StockStatus.aman:
        return 'Aman';
      case StockStatus.menipis:
        return 'Menipis';
      case StockStatus.kritis:
        return 'Kritis';
      case StockStatus.habis:
        return 'Habis';
    }
  }

  Color get color {
    switch (this) {
      case StockStatus.aman:
        return AppColors.success;
      case StockStatus.menipis:
        return AppColors.warning;
      case StockStatus.kritis:
        return AppColors.accentOrange;
      case StockStatus.habis:
        return AppColors.critical;
    }
  }
}
