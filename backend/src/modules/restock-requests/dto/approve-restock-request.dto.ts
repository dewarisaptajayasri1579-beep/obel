import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsInt, Min, ValidateNested, IsUUID } from 'class-validator';

export class ApproveRestockItemDto {
  @IsUUID()
  productId!: string;

  @IsInt()
  @Min(1)
  qtyApproved!: number;
}

export class ApproveRestockRequestDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ApproveRestockItemDto)
  items!: ApproveRestockItemDto[];
}
