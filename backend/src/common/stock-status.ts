export type StockStatus = 'Aman' | 'Menipis' | 'Kritis' | 'Habis';

/// Sesuai BR-007 08-business-rules.md.
export function resolveStockStatus(qty: number, minimumQty: number, criticalQty: number): StockStatus {
  if (qty <= 0) return 'Habis';
  if (qty <= criticalQty) return 'Kritis';
  if (qty <= minimumQty) return 'Menipis';
  return 'Aman';
}
