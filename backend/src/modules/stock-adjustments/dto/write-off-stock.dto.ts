import { IsInt, IsOptional, IsString, IsUUID, Matches, Min } from 'class-validator';

export const STOCK_WRITE_OFF_SUBDIR = 'stock-write-offs';

/// URL hasil POST /stock-adjustments/write-off/photo — cuma menerima file yang
/// memang diunggah ke server ini, bukan URL gambar sembarang.
export const POLA_URL_FOTO_PEMUSNAHAN = new RegExp(
  `/uploads/${STOCK_WRITE_OFF_SUBDIR}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\\.(jpe?g|png|webp|gif)$`,
);

/// Pemusnahan Stok Gudang (BR-041): qty yang dibuang, bukan target qty.
export class WriteOffStockDto {
  @IsUUID()
  idempotencyKey!: string;

  @IsUUID()
  productId!: string;

  @IsInt()
  @Min(1)
  qty!: number;

  @Matches(POLA_URL_FOTO_PEMUSNAHAN, { message: 'Foto bukti pemusnahan tidak valid.' })
  photoUrl!: string;

  @IsOptional()
  @IsString()
  reasonNote?: string;
}
