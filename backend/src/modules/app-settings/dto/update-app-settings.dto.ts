import { IsInt, Max, Min } from 'class-validator';

export class UpdateAppSettingsDto {
  /// Batas 10-600 detik (10 detik – 10 menit) — di bawah 10 detik terlalu
  /// boros baterai untuk manfaat akurasi yang kecil, di atas 10 menit sudah
  /// tidak pantas disebut "realtime" untuk booth yang bergerak.
  @IsInt()
  @Min(10)
  @Max(600)
  gpsPingIntervalSeconds!: number;
}
