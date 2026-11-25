import { IsBoolean, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

/// Satu baris Varian Rasa di form Produk. Tanpa `id` = varian baru; varian lama yang tidak
/// dikirim lagi dihapus (atau dinonaktifkan bila sudah terjual), lihat
/// ProductsService.sinkronkanVarian.
export class ProductVariantDto {
  @IsOptional()
  @IsUUID()
  id?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(60)
  name!: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
