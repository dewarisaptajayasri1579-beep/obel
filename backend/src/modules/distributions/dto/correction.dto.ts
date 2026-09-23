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

export class DistributionItemQtyDto {
  @IsUUID()
  productId!: string;

  @IsInt()
  @Min(0)
  qty!: number;
}

/// Tindak lanjut Admin per baris produk yang selisih saat Koreksi Penerimaan
/// (lihat distributions.service.ts correctReceipt()):
/// - RUSAK: qty tetap dikurangi dari stok, ditandai utk Laporan Stok Rusak.
/// - SALAH_HITUNG: qty dikembalikan/dikoreksi, tidak lagi dianggap kerugian.
/// - GANTI_RUGI_PETUGAS: dicatat sebagai StaffLiability dibebankan ke
///   Petugas yang menerima (distribution.receivedById), belum ada alur
///   pelunasan.
/// - LAINNYA: tidak ada aksi stok/liability otomatis, cuma catatan bebas
///   (tindakLanjutNote) yang masuk activity log — buat kasus di luar 3 di
///   atas.
export type TindakLanjutSelisih = 'RUSAK' | 'SALAH_HITUNG' | 'GANTI_RUGI_PETUGAS' | 'LAINNYA';
const TINDAK_LANJUT_VALUES: TindakLanjutSelisih[] = ['RUSAK', 'SALAH_HITUNG', 'GANTI_RUGI_PETUGAS', 'LAINNYA'];

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
