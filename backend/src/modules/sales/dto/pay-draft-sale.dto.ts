import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsEnum, IsOptional, Matches, ValidateNested } from 'class-validator';
import { PaymentMethod } from '@prisma/client';
import { PaymentSplitDto, POLA_URL_BUKTI_QRIS } from './create-sale.dto';

/// Melunasi draft (POST /sales/:id/pay) — di sinilah stok baru dipotong
/// (lihat SalesService.payDraftSale). Sama pola validasi salah-satu dengan
/// CreateSaleDto: `paymentMethod` ATAU `payments` (Split).
export class PayDraftSaleDto {
  @IsOptional()
  @IsEnum([PaymentMethod.CASH, PaymentMethod.QRIS])
  paymentMethod?: typeof PaymentMethod.CASH | typeof PaymentMethod.QRIS;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(2)
  @ValidateNested({ each: true })
  @Type(() => PaymentSplitDto)
  payments?: PaymentSplitDto[];

  @IsOptional()
  @Matches(POLA_URL_BUKTI_QRIS, { message: 'Foto bukti bayar QRIS tidak valid.' })
  qrisProofPhotoUrl?: string;
}
