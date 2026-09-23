import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsInt, IsOptional, IsString, Min, ValidateNested, IsUUID } from 'class-validator';

export class ReceiveReturnItemDto {
  @IsUUID()
  productId!: string;

  @IsInt()
  @Min(0)
  qtyReceived!: number;
}

export class ReceiveReturnDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ReceiveReturnItemDto)
  items!: ReceiveReturnItemDto[];

  /// Wajib diisi kalau ada item dengan qtyReceived != qtySubmitted (lihat
  /// ReturnsService.receive).
  @IsOptional()
  @IsString()
  note?: string;
}
