import { IsInt, IsLatitude, IsLongitude, IsOptional, Max, Min, ValidateIf } from 'class-validator';

/// Semua field opsional — tiap layar (Monitoring, Pengaturan Absensi) hanya
/// mengirim bagian yang ia ubah.
export class UpdateAppSettingsDto {
  /// Batas 10-600 detik (10 detik – 10 menit) — di bawah 10 detik terlalu
  /// boros baterai untuk manfaat akurasi yang kecil, di atas 10 menit sudah
  /// tidak pantas disebut "realtime" untuk booth yang bergerak.
  @IsOptional()
  @IsInt()
  @Min(10)
  @Max(600)
  gpsPingIntervalSeconds?: number;

  /// Koordinat Gudang (acuan absen Berangkat & Kembali, BR-042). `null` mengosongkan.
  @IsOptional()
  @ValidateIf((o) => o.warehouseLatitude !== null)
  @IsLatitude()
  warehouseLatitude?: number | null;

  @IsOptional()
  @ValidateIf((o) => o.warehouseLongitude !== null)
  @IsLongitude()
  warehouseLongitude?: number | null;

  /// Radius absen dari titik acuan. 20 m ke bawah tidak realistis untuk GPS HP;
  /// di atas 1 km validasinya tidak bermakna lagi.
  @IsOptional()
  @IsInt()
  @Min(20)
  @Max(1000)
  attendanceRadiusMeters?: number;

  /// Menit sebelum jam selesai shift Check-Out sudah boleh (0 = tepat jam selesai).
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(180)
  earlyCheckoutToleranceMinutes?: number;
}
