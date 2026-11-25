import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsInt, IsOptional, IsUUID, Min, MinLength, IsString, IsUrl, ValidateNested } from 'class-validator';
import { ProductVariantDto } from './product-variant.dto';

/// TX-15/TX-16 (24-data-consistency-correction-reversal.md): perubahan
/// master price/nama hanya berlaku untuk transaksi BARU — sale lama tetap
/// memakai unit_price snapshot di sale_items, jadi update di sini tidak
/// perlu (dan tidak boleh) merestate histori. Nonaktifkan produk memakai
/// `active=false`, bukan hard delete (data histori tetap punya relasi FK
/// yang valid).
export class UpdateProductDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  sellPrice?: number;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @IsUrl({ require_tld: false }, { message: 'imageUrl harus berupa URL yang valid.' })
  imageUrl?: string | null;

  /// Default stok Menipis/Kritis produk ini di seluruh booth — lihat komentar
  /// Product.minimumQty di schema.prisma. Override per-booth (BoothStockThreshold)
  /// tetap menang kalau Admin sudah mengustomisasinya lewat halaman Threshold.
  @IsOptional()
  @IsInt()
  @Min(0)
  minimumQty?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  criticalQty?: number;

  /// Daftar lengkap Varian Rasa. Tidak dikirim = varian tidak diubah.
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductVariantDto)
  variants?: ProductVariantDto[];
}
