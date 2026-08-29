import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsInt, IsOptional, IsString, IsUUID, Min, ValidateNested } from 'class-validator';

export class ReturnItemDto {
  @IsUUID()
  productId!: string;

  @IsInt()
  @Min(1)
  qty!: number;
}

export class CreateReturnDto {
  /// Kalau kosong, service otomatis mengisi dari seluruh booth_stocks
  /// booth ini yang qty > 0 (BR-013: "Return qty default = actual stock
  /// setelah closing").
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ReturnItemDto)
  items?: ReturnItemDto[];

  @IsOptional()
  @IsString()
  note?: string;
}
