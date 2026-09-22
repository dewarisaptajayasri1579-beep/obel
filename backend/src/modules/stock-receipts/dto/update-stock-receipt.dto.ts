import { Type } from 'class-transformer';
import { IsArray, IsDateString, IsOptional, IsString, ValidateNested } from 'class-validator';
import { StockReceiptItemDto } from './create-stock-receipt.dto';

/// Hanya berlaku untuk dokumen berstatus DRAFT — lihat
/// StockReceiptsService.update(). Field yang tidak dikirim tidak diubah,
/// KECUALI `items`: kalau dikirim, menggantikan SELURUH baris item (bukan
/// merge), karena tabelnya selalu direpresentasikan utuh di layar.
export class UpdateStockReceiptDto {
  @IsOptional()
  @IsDateString()
  receiptDate?: string;

  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StockReceiptItemDto)
  items?: StockReceiptItemDto[];
}
