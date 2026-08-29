import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { PaymentMethod, ReasonCode } from '@prisma/client';
import { SaleItemDto } from './create-sale.dto';

export class ReviseSaleDto {
  @IsUUID()
  idempotencyKey!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => SaleItemDto)
  items!: SaleItemDto[];

  @IsOptional()
  @IsEnum(PaymentMethod)
  paymentMethod?: PaymentMethod;

  @IsEnum(ReasonCode)
  reasonCode!: ReasonCode;

  @IsOptional()
  @IsString()
  reasonNote?: string;
}

export class RevisePaymentDto {
  @IsUUID()
  idempotencyKey!: string;

  @IsEnum(PaymentMethod)
  method!: PaymentMethod;

  @IsEnum(ReasonCode)
  reasonCode!: ReasonCode;

  @IsOptional()
  @IsString()
  reasonNote?: string;
}
