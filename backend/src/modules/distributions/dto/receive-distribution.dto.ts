import { Type } from 'class-transformer';
import { DiscrepancyReasonCode } from '@prisma/client';
import { ArrayMinSize, IsArray, IsEnum, IsInt, IsOptional, IsString, Min, ValidateNested, IsUUID } from 'class-validator';

export class ReceiveDistributionItemDto {
  @IsUUID()
  productId!: string;

  @IsInt()
  @Min(0)
  actualQty!: number;

  /// Alasan selisih baris ini (checklist "Kenapa selisih?" di
  /// petugas/terima-stok/page.tsx) — dipakai Laporan Stok Rusak. Wajib diisi
  /// dari frontend kalau actualQty != qtySent, tapi tidak divalidasi wajib
  /// di sini supaya endpoint tetap backward-compatible untuk caller lain.
  @IsOptional()
  @IsEnum(DiscrepancyReasonCode)
  reasonCode?: DiscrepancyReasonCode;

  @IsOptional()
  @IsString()
  reasonNote?: string;
}

export class ReceiveDistributionDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ReceiveDistributionItemDto)
  items!: ReceiveDistributionItemDto[];

  /// Catatan Petugas saat ada selisih Qty Terima vs Qty Kirim — wajib diisi
  /// di form (lihat petugas/terima-stok/page.tsx), disimpan di activity log
  /// supaya Admin lihat alasan selisihnya sebelum pakai "Koreksi Penerimaan".
  @IsOptional()
  @IsString()
  note?: string;
}
