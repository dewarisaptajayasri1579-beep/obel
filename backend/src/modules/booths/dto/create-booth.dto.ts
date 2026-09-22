import { IsLatitude, IsLongitude, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateBoothDto {
  @IsString()
  @MinLength(1)
  code!: string;

  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @IsString()
  locationName?: string;

  @IsOptional()
  @IsString()
  address?: string;

  /// Titik tetap Booth untuk peta Monitoring — lihat
  /// docs/obbel-coffee-ai-docs/26-monitoring-realtime.md §4.2/§5. Opsional:
  /// Booth boleh dibuat tanpa titik lokasi dan diisi belakangan.
  @IsOptional()
  @IsLatitude()
  latitude?: number;

  @IsOptional()
  @IsLongitude()
  longitude?: number;
}
