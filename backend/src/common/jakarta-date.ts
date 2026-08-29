const JAKARTA_OFFSET_MS = 7 * 60 * 60 * 1000;

/// Awal hari ini menurut Asia/Jakarta, dinyatakan sebagai instant UTC —
/// dipakai karena laporan harian dikelompokkan per tanggal lokal
/// (02-system-architecture.md §7), sementara timestamp di DB tetap UTC.
export function startOfTodayJakarta(): Date {
  return startOfDayJakarta(new Date());
}

export function startOfDayJakarta(date: Date): Date {
  const jakartaTime = new Date(date.getTime() + JAKARTA_OFFSET_MS);
  const startOfDayWallClock = Date.UTC(
    jakartaTime.getUTCFullYear(),
    jakartaTime.getUTCMonth(),
    jakartaTime.getUTCDate(),
  );
  return new Date(startOfDayWallClock - JAKARTA_OFFSET_MS);
}

/// Kunci "YYYY-MM-DD" berdasarkan tanggal lokal Asia/Jakarta, dipakai untuk
/// mengelompokkan baris transaksi per business date.
export function businessDateKeyJakarta(date: Date): string {
  const jakartaTime = new Date(date.getTime() + JAKARTA_OFFSET_MS);
  return jakartaTime.toISOString().slice(0, 10);
}
