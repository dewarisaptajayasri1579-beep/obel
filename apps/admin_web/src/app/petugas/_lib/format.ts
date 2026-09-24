export function formatRupiah(n: number): string {
  return `Rp${Math.round(n).toLocaleString("id-ID")}`;
}

export function formatTanggalJakarta(iso: string): string {
  return new Date(iso).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  });
}

export function formatJamJakarta(iso: string): string {
  return (
    new Date(iso).toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Asia/Jakarta",
    }).replace(".", ".") + " WIB"
  );
}

/// "X jam Y menit" dari dua titik waktu — dipakai kartu "Ringkasan Shift" di
/// layar Check Out (Jam Check-In s/d Jam Sekarang).
export function formatDurasi(dariIso: string, sampai: Date): string {
  const menitTotal = Math.max(0, Math.floor((sampai.getTime() - new Date(dariIso).getTime()) / 60000));
  const jam = Math.floor(menitTotal / 60);
  const menit = menitTotal % 60;
  return `${jam} jam ${menit} menit`;
}

/// Awal hari ini menurut Asia/Jakarta (00.00 WIB), dinyatakan sebagai instant
/// UTC — dipakai buat menyaring transaksi "hari ini" di sisi klien tanpa
/// tergantung timezone browser Petugas.
export function startOfTodayJakarta(): Date {
  const now = new Date(Date.now() + 7 * 60 * 60 * 1000);
  const start = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return new Date(start - 7 * 60 * 60 * 1000);
}
