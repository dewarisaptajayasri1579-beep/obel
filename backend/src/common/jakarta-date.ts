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

/// Batas satu bulan kalender Asia/Jakarta, dinyatakan sebagai instant UTC —
/// dipakai untuk menyaring kolom timestamp UTC biasa (mis. `Sale.paidAt`)
/// per periode bulanan tanpa tujuh jam pertama tanggal 1 jatuh ke bulan
/// sebelumnya. Beda dari kolom DATE polos (`StockMovement.businessDate`,
/// lihat stock-movements.service.ts `batasPeriode`) yang batasnya UTC murni.
export function batasBulanJakarta(bulan: number, tahun: number): { awal: Date; akhir: Date } {
  const awalWallClock = Date.UTC(tahun, bulan - 1, 1);
  const akhirWallClock = Date.UTC(tahun, bulan, 1);
  return {
    awal: new Date(awalWallClock - JAKARTA_OFFSET_MS),
    akhir: new Date(akhirWallClock - JAKARTA_OFFSET_MS),
  };
}
