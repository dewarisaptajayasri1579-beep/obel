import { IsLatitude, IsLongitude, IsString, MinLength } from 'class-validator';

/// Absen Tiba (Booth) / Kembali (Gudang): GPS + foto, divalidasi radius (BR-042).
export class AttendanceDto {
  @IsLatitude()
  latitude!: number;

  @IsLongitude()
  longitude!: number;

  @IsString()
  @MinLength(1)
  photoUrl!: string;
}
