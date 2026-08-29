import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsInt, IsUUID, Min, ValidateNested } from 'class-validator';

export class ThresholdItemDto {
  @IsUUID()
  productId!: string;

  @IsInt()
  @Min(0)
  minimumQty!: number;

  @IsInt()
  @Min(0)
  criticalQty!: number;
}

export class BulkUpsertThresholdDto {
  @IsUUID()
  boothId!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ThresholdItemDto)
  items!: ThresholdItemDto[];
}
