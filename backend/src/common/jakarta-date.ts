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

/// Gabungkan tanggal bisnis Asia/Jakarta (dari startOfDayJakarta) dengan jam
/// "HH:mm" jadi satu instant UTC, mis. untuk ShiftSession.scheduledStartAt.
export function combineJakartaDateAndTime(businessDate: Date, hhmm: string): Date {
  const [hours, minutes] = hhmm.split(':').map(Number);
  const jakartaMidnight = new Date(businessDate.getTime() + JAKARTA_OFFSET_MS);
  const wallClock = Date.UTC(
    jakartaMidnight.getUTCFullYear(),
    jakartaMidnight.getUTCMonth(),
    jakartaMidnight.getUTCDate(),
    hours,
    minutes,
  );
  return new Date(wallClock - JAKARTA_OFFSET_MS);
}

/// Kunci "YYYY-MM-DD" berdasarkan tanggal lokal Asia/Jakarta, dipakai untuk
/// mengelompokkan baris transaksi per business date.
export function businessDateKeyJakarta(date: Date): string {
  const jakartaTime = new Date(date.getTime() + JAKARTA_OFFSET_MS);
  return jakartaTime.toISOString().slice(0, 10);
}

/// Tanggal bisnis Asia/Jakarta dari sebuah instant UTC, dinyatakan sebagai
/// Date yang UTC Y/M/D-nya SUDAH merupakan tanggal kalender Jakarta yang
/// benar — dipakai untuk kolom `@db.Date` polos seperti
/// `StockMovement.businessDate` (Postgres DATE mengambil Y/M/D dari field UTC
/// Date JS-nya apa adanya, bukan konsep instant). BEDA dari `startOfDayJakarta`
/// (dipakai untuk kolom timestamptz, hasilnya instant UTC yang SECARA WAKTU
/// sama dengan tengah malam Jakarta — Y/M/D UTC-nya justru sering mundur
/// sehari karena itu instant 17:00 UTC hari sebelumnya).
///
/// WAJIB pakai ini untuk businessDate StockMovement/transaksi — jangan
/// reimplementasi `Date.UTC(date.getUTCFullYear(), ...)` manual tanpa geser
/// +7 jam dulu (riwayat: dulu ada 8 salinan identik yang lupa langkah geser
/// ini, jadi transaksi jam 00:00-06:59 WIB kena tanggal mundur sehari).
export function businessDateOf(date: Date): Date {
  const jakartaTime = new Date(date.getTime() + JAKARTA_OFFSET_MS);
  return new Date(Date.UTC(jakartaTime.getUTCFullYear(), jakartaTime.getUTCMonth(), jakartaTime.getUTCDate()));
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

/// Batas rentang tanggal bebas (inklusif) Asia/Jakarta dari string
/// "YYYY-MM-DD" — dipakai filter periode Dashboard (Hari Ini/Minggu Ini/
/// Bulan Ini/Custom) yang butuh rentang arbitrer, beda dari
/// `batasBulanJakarta` yang selalu satu bulan kalender penuh.
export function rangeJakarta(startDateStr: string, endDateStr: string): { awal: Date; akhir: Date } {
  const [sy, sm, sd] = startDateStr.split('-').map(Number);
  const [ey, em, ed] = endDateStr.split('-').map(Number);
  return {
    awal: new Date(Date.UTC(sy, sm - 1, sd) - JAKARTA_OFFSET_MS),
    akhir: new Date(Date.UTC(ey, em - 1, ed + 1) - JAKARTA_OFFSET_MS),
  };
}
