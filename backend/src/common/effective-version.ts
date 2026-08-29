/// Setiap transaksi bervarian (Sale, StockDistribution, StockReturn, Payment,
/// StockOpname) menyimpan SEMUA versi historisnya (DC-002/DC-003). Laporan
/// wajib membaca hanya versi efektif (terbaru) per transaction_group_id —
/// lihat docs/24-data-consistency-correction-reversal.md §14.
export function effectiveByGroup<T extends { transactionGroupId: string; versionNo: number }>(
  rows: T[],
): T[] {
  const latest = new Map<string, T>();
  for (const row of rows) {
    const current = latest.get(row.transactionGroupId);
    if (!current || row.versionNo > current.versionNo) {
      latest.set(row.transactionGroupId, row);
    }
  }
  return [...latest.values()];
}
