import { IsEnum, IsInt, IsOptional, IsString, IsUUID, Min, ValidateIf } from 'class-validator';
import { OpnameLocationType, ReasonCode } from '@prisma/client';

export class CreateStockAdjustmentDto {
  @IsUUID()
  idempotencyKey!: string;

  @IsEnum(OpnameLocationType)
  locationType!: OpnameLocationType;

  @ValidateIf((o) => o.locationType === OpnameLocationType.BOOTH)
  @IsUUID()
  boothId?: string;

  @IsUUID()
  productId!: string;

  @IsInt()
  @Min(0)
  targetQty!: number;

  @IsEnum(ReasonCode)
  reasonCode!: ReasonCode;

  @IsOptional()
  @IsString()
  reasonNote?: string;
}

export class ReverseStockAdjustmentDto {
  @IsUUID()
  idempotencyKey!: string;

  @IsEnum(ReasonCode)
  reasonCode!: ReasonCode;

  @IsOptional()
  @IsString()
  reasonNote?: string;
}
