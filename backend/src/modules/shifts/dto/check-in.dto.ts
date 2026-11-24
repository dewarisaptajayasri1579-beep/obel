import { IsLatitude, IsLongitude, IsString, MinLength } from 'class-validator';

/// Absen Berangkat di Gudang. Booth tidak dipilih di sini: shift dibuka di Booth roster staff,
/// dan Barista memilih booth (boleh selain roster) saat Absen Tiba.
export class CheckInDto {
  /// GPS + foto selfie absen Berangkat — divalidasi radius terhadap Gudang
  /// (ShiftsService.periksaLokasi, BR-042).
  @IsLatitude()
  latitude!: number;

  @IsLongitude()
  longitude!: number;

  @IsString()
  @MinLength(1)
  photoUrl!: string;
}
