import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsUUID,
  Matches,
  Min,
  ValidateNested,
} from 'class-validator';
import { PaymentMethod } from '@prisma/client';

export const PAYMENT_PROOF_SUBDIR = 'payment-proofs';

/// URL hasil POST /sales/payment-proof/photo — cuma menerima file yang
/// memang diunggah ke server ini, bukan URL gambar sembarang.
export const POLA_URL_BUKTI_QRIS = new RegExp(
  `/uploads/${PAYMENT_PROOF_SUBDIR}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\\.(jpe?g|png|webp|gif)$`,
);

export class SaleItemDto {
  @IsUUID()
  productId!: string;

  @IsInt()
  @Min(1)
  qty!: number;
}

/// Satu pecahan pembayaran Split — CASH/QRIS saja (bukan SPLIT, itu nilai
/// gabungan yang dihitung backend, tidak pernah dikirim client).
export class PaymentSplitDto {
  @IsEnum([PaymentMethod.CASH, PaymentMethod.QRIS])
  method!: typeof PaymentMethod.CASH | typeof PaymentMethod.QRIS;

  @IsInt()
  @Min(1)
  amount!: number;
}

export class CreateSaleDto {
  @IsUUID()
  idempotencyKey!: string;

  @IsUUID()
  shiftSessionId!: string;

  /// Salah satu WAJIB diisi: `paymentMethod` (bayar satu metode) ATAU
  /// `payments` (Split, >=2 baris) — divalidasi di SalesService.
  /// createPaidSale/payDraftSale, bukan di DTO (butuh konteks total).
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
  @IsInt()
  @Min(0)
  discount?: number;

  /// Wajib untuk petugas booth kalau ada pembayaran QRIS (lihat
  /// SalesService.pastikanBuktiQris).
  @IsOptional()
  @Matches(POLA_URL_BUKTI_QRIS, { message: 'Foto bukti bayar QRIS tidak valid.' })
  qrisProofPhotoUrl?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => SaleItemDto)
  items!: SaleItemDto[];
}
