import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import { ReasonCode } from '@prisma/client';
import { TINDAK_LANJUT_VALUES, type TindakLanjutSelisih } from '../../../common/tindak-lanjut';

export type { TindakLanjutSelisih } from '../../../common/tindak-lanjut';

export class DistributionItemQtyDto {
  @IsUUID()
  productId!: string;

  @IsInt()
  @Min(0)
  qty!: number;
}

export class CorrectReceiptItemDto extends DistributionItemQtyDto {
  @IsOptional()
  @IsIn(TINDAK_LANJUT_VALUES)
  tindakLanjut?: TindakLanjutSelisih;

  @IsOptional()
  @IsString()
  tindakLanjutNote?: string;
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
  @Type(() => CorrectReceiptItemDto)
  items!: CorrectReceiptItemDto[];

  @IsEnum(ReasonCode)
  reasonCode!: ReasonCode;

  @IsOptional()
  @IsString()
  reasonNote?: string;
}
