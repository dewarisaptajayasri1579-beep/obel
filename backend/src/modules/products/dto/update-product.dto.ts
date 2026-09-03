import { IsBoolean, IsInt, IsOptional, IsUUID, Min, MinLength, IsString } from 'class-validator';

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
}
