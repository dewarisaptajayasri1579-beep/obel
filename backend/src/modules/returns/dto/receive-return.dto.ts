import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsIn, IsInt, IsOptional, IsString, Min, ValidateNested, IsUUID } from 'class-validator';
import { TINDAK_LANJUT_VALUES, type TindakLanjutSelisih } from '../../../common/tindak-lanjut';

export class ReceiveReturnItemDto {
  @IsUUID()
  productId!: string;

  @IsInt()
  @Min(0)
  qtyReceived!: number;

  /// Wajib diisi kalau qtyReceived != qtySubmitted (lihat ReturnsService.receive).
  @IsOptional()
  @IsIn(TINDAK_LANJUT_VALUES)
  tindakLanjut?: TindakLanjutSelisih;

  /// Wajib diisi kalau tindakLanjut = LAINNYA.
  @IsOptional()
  @IsString()
  tindakLanjutNote?: string;
}

export class ReceiveReturnDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ReceiveReturnItemDto)
  items!: ReceiveReturnItemDto[];
}
