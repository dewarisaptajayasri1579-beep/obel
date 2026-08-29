import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsInt, IsOptional, IsString, IsUUID, Min, ValidateNested } from 'class-validator';

export class DistributionItemDto {
  @IsUUID()
  productId!: string;

  @IsInt()
  @Min(1)
  qty!: number;
}

export class CreateDistributionDto {
  @IsUUID()
  idempotencyKey!: string;

  @IsUUID()
  boothId!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => DistributionItemDto)
  items!: DistributionItemDto[];

  @IsOptional()
  @IsString()
  note?: string;
}
