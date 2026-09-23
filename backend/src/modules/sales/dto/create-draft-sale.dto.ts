import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsInt, IsOptional, IsUUID, Min, ValidateNested } from 'class-validator';
import { SaleItemDto } from './create-sale.dto';

/// "Simpan Draft" — Sale dibuat status PENDING, item & harga di-snapshot,
/// TAPI stok belum dipotong dan belum ada Payment (metode bayar belum
/// ditentukan). Baru menyentuh stok saat SalesService.payDraftSale
/// dipanggil (POST /sales/:id/pay).
export class CreateDraftSaleDto {
  @IsUUID()
  idempotencyKey!: string;

  @IsUUID()
  shiftSessionId!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => SaleItemDto)
  items!: SaleItemDto[];

  @IsOptional()
  @IsInt()
  @Min(0)
  discount?: number;
}
