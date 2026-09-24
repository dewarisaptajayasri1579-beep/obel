import { IsISO8601, IsLatitude, IsLongitude, IsOptional } from 'class-validator';

/// Ping lokasi berkala dari app petugas (lihat apps/booth_pwa_flutter,
/// action `gps.start`). Berbeda dari CheckInDto: ini dikirim tiap ~1 menit
/// selama shift berjalan, bukan sekali di momen absen.
export class LocationPingDto {
  @IsLatitude()
  latitude!: number;

  @IsLongitude()
  longitude!: number;

  @IsOptional()
  @IsISO8601()
  capturedAt?: string;
}
