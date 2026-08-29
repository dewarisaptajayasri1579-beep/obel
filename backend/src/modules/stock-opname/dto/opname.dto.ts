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
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { OpnameLocationType, ReasonCode } from '@prisma/client';

export class StartOpnameDto {
  @IsEnum(OpnameLocationType)
  locationType!: OpnameLocationType;

  @ValidateIf((o) => o.locationType === OpnameLocationType.BOOTH)
  @IsUUID()
  boothId?: string;
}

export class OpnameCountItemDto {
  @IsUUID()
  productId!: string;

  @IsInt()
  @Min(0)
  actualQty!: number;
}

export class ConfirmOpnameDto {
  @IsUUID()
  idempotencyKey!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => OpnameCountItemDto)
  items!: OpnameCountItemDto[];

  @IsEnum(ReasonCode)
  reasonCode!: ReasonCode;

  @IsOptional()
  @IsString()
  reasonNote?: string;
}

export class RecountOpnameDto {
  @IsUUID()
  idempotencyKey!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => OpnameCountItemDto)
  items!: OpnameCountItemDto[];

  @IsEnum(ReasonCode)
  reasonCode!: ReasonCode;

  @IsOptional()
  @IsString()
  reasonNote?: string;
}
