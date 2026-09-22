import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsDateString, IsIn, IsInt, IsOptional, IsString, IsUUID, Min, ValidateNested } from 'class-validator';

export class StockReceiptItemDto {
  @IsUUID()
  productId!: string;

  @IsInt()
  @Min(0)
  qtyReceived!: number;
}

export class CreateStockReceiptDto {
  @IsString()
  idempotencyKey!: string;

  @IsDateString()
  receiptDate!: string;

  @IsOptional()
  @IsString()
  note?: string;

  /// "DRAFT" (bawaan, tombol Simpan Draft) atau "POSTED" (tombol Posting
  /// langsung tanpa transit lewat Draft).
  @IsOptional()
  @IsIn(['DRAFT', 'POSTED'])
  status?: 'DRAFT' | 'POSTED';

  /// Hanya baris dengan qty > 0 yang perlu dikirim — tabel di layar
  /// menampilkan SEMUA produk, tapi baris bernilai 0 tidak berarti apa-apa
  /// buat dokumen ini dan tidak usah tersimpan sebagai item.
  @IsArray()
  @ArrayMinSize(0)
  @ValidateNested({ each: true })
  @Type(() => StockReceiptItemDto)
  items!: StockReceiptItemDto[];
}
