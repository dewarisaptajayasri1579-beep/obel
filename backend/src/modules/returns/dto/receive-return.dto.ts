import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsInt, Min, ValidateNested, IsUUID } from 'class-validator';

export class ReceiveReturnItemDto {
  @IsUUID()
  productId!: string;

  @IsInt()
  @Min(0)
  qtyReceived!: number;
}

export class ReceiveReturnDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ReceiveReturnItemDto)
  items!: ReceiveReturnItemDto[];
}
