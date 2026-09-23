import { IsLatitude, IsLongitude, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';

export class CheckInDto {
  /// Override manual — kosong berarti pakai Booth dari BoothShiftAssignment
  /// milik staff yang login.
  @IsOptional()
  @IsUUID()
  boothId?: string;

  /// GPS + foto selfie diambil saat Check-In (soft-check saja terhadap
  /// lokasi Booth — lihat ShiftsService.computeLocationWarning, TIDAK
  /// memblokir absen).
  @IsLatitude()
  latitude!: number;

  @IsLongitude()
  longitude!: number;

  @IsString()
  @MinLength(1)
  photoUrl!: string;
}
