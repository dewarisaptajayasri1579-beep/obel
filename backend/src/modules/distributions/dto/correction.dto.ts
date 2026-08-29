import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import { ReasonCode } from '@prisma/client';

export class DistributionItemQtyDto {
  @IsUUID()
  productId!: string;

  @IsInt()
  @Min(0)
  qty!: number;
}

export class CancelDistributionDto {
  @IsUUID()
  idempotencyKey!: string;

  @IsEnum(ReasonCode)
  reasonCode!: ReasonCode;

  @IsOptional()
  @IsString()
  reasonNote?: string;
}

export class ReviseDistributionDto {
  @IsUUID()
  idempotencyKey!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => DistributionItemQtyDto)
  items!: DistributionItemQtyDto[];

  @IsEnum(ReasonCode)
  reasonCode!: ReasonCode;

  @IsOptional()
  @IsString()
  reasonNote?: string;
}

export class CorrectReceiptDto {
  @IsUUID()
  idempotencyKey!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => DistributionItemQtyDto)
  items!: DistributionItemQtyDto[];

  @IsEnum(ReasonCode)
  reasonCode!: ReasonCode;

  @IsOptional()
  @IsString()
  reasonNote?: string;
}
