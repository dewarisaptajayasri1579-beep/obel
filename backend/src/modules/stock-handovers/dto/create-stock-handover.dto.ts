import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsOptional, IsString, IsUUID, ValidateNested } from 'class-validator';
import { DistributionItemDto } from '../../distributions/dto/create-distribution.dto';

/// Admin kirim langsung ke Petugas yang sedang Aktif — Booth TIDAK dipilih
/// manual, diturunkan dari ShiftSession Petugas terpilih (lihat
/// StockHandoversService.create).
export class CreateStockHandoverDto {
  @IsUUID()
  staffId!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => DistributionItemDto)
  items!: DistributionItemDto[];

  @IsOptional()
  @IsString()
  note?: string;
}
