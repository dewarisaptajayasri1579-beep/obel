import { IsEnum, IsLatitude, IsLongitude, IsOptional, IsString, MinLength } from 'class-validator';
import { BoothStatus } from '@prisma/client';

/// Kode Booth SENGAJA tidak bisa diubah lewat sini — sama seperti SKU Produk,
/// kode ini sudah bisa terpakai di dokumen/laporan yang sudah terbit.
export class UpdateBoothDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsString()
  locationName?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsLatitude()
  latitude?: number;

  @IsOptional()
  @IsLongitude()
  longitude?: number;

  @IsOptional()
  @IsEnum(BoothStatus)
  status?: BoothStatus;

  @IsOptional()
  @IsString()
  qrisImageUrl?: string;
}
