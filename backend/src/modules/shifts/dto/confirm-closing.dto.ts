import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';

export class ConfirmClosingItemDto {
  @IsUUID()
  productId!: string;

  @IsInt()
  @Min(0)
  actualQty!: number;

  @IsOptional()
  @IsString()
  reasonCode?: string;

  @IsOptional()
  @IsString()
  reasonNote?: string;
}

export class ConfirmClosingDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ConfirmClosingItemDto)
  items!: ConfirmClosingItemDto[];
}
