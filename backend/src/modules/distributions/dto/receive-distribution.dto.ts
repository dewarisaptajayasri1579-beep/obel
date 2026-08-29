import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsInt, Min, ValidateNested, IsUUID } from 'class-validator';

export class ReceiveDistributionItemDto {
  @IsUUID()
  productId!: string;

  @IsInt()
  @Min(0)
  actualQty!: number;
}

export class ReceiveDistributionDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ReceiveDistributionItemDto)
  items!: ReceiveDistributionItemDto[];
}
