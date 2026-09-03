import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsEnum, IsInt, IsOptional, IsString, IsUUID, Min, ValidateNested } from 'class-validator';
import { ReasonCode } from '@prisma/client';

export class ReturnItemQtyDto {
  @IsUUID()
  productId!: string;

  @IsInt()
  @Min(0)
  qty!: number;
}

export class CancelReturnDto {
  @IsUUID()
  idempotencyKey!: string;

  @IsEnum(ReasonCode)
  reasonCode!: ReasonCode;

  @IsOptional()
  @IsString()
  reasonNote?: string;
}

export class ReviseReturnDto {
  @IsUUID()
  idempotencyKey!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ReturnItemQtyDto)
  items!: ReturnItemQtyDto[];

  @IsEnum(ReasonCode)
  reasonCode!: ReasonCode;

  @IsOptional()
  @IsString()
  reasonNote?: string;
}

export class CorrectReturnReceiptDto {
  @IsUUID()
  idempotencyKey!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ReturnItemQtyDto)
  items!: ReturnItemQtyDto[];

  @IsEnum(ReasonCode)
  reasonCode!: ReasonCode;

  @IsOptional()
  @IsString()
  reasonNote?: string;
}
