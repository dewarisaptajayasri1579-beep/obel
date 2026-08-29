import { IsInt, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class AdjustWarehouseStockDto {
  @IsUUID()
  productId!: string;

  @IsInt()
  @Min(0)
  targetQty!: number;

  @IsOptional()
  @IsString()
  reason?: string;
}
