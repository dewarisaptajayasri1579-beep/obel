import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  ValidateNested,
} from 'class-validator';
import { PaymentMethod, ReasonCode } from '@prisma/client';
import { PaymentSplitDto, POLA_URL_BUKTI_QRIS, SaleItemDto } from './create-sale.dto';

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

/// Ganti metode bayar sale yang sudah PAID (TX-04). Bentuknya sama dengan saat
/// bayar: `method` (satu metode penuh) ATAU `payments` (Split, >=2 baris) —
/// divalidasi di SalesService.revisePayment (butuh total sale).
export class RevisePaymentDto {
  @IsUUID()
  idempotencyKey!: string;

  @IsOptional()
  @IsEnum([PaymentMethod.CASH, PaymentMethod.QRIS])
  method?: typeof PaymentMethod.CASH | typeof PaymentMethod.QRIS;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(2)
  @ValidateNested({ each: true })
  @Type(() => PaymentSplitDto)
  payments?: PaymentSplitDto[];

  /// Wajib untuk Barista kalau metode barunya memuat QRIS (BR-038).
  @IsOptional()
  @Matches(POLA_URL_BUKTI_QRIS, { message: 'Foto bukti bayar QRIS tidak valid.' })
  qrisProofPhotoUrl?: string;

  @IsEnum(ReasonCode)
  reasonCode!: ReasonCode;

  @IsOptional()
  @IsString()
  reasonNote?: string;
}
