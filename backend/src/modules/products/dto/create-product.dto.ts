import { Type } from 'class-transformer';
import { IsArray, IsInt, IsOptional, IsString, IsUUID, Min, MinLength, IsUrl, ValidateNested } from 'class-validator';
import { ProductVariantDto } from './product-variant.dto';

export class CreateProductDto {
  /// Kode barang dibuat otomatis oleh server (`OBL-0001`). Klien BOLEH tidak
  /// mengirimnya sama sekali; kalau dikirim, dipakai apa adanya — jalur itu
  /// disediakan untuk seed dan impor data lama, bukan untuk form.
  @IsOptional()
  @IsString()
  @MinLength(1)
  sku?: string;

  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsInt()
  @Min(0)
  sellPrice!: number;

  @IsOptional()
  @IsUrl({ require_tld: false })
  imageUrl?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductVariantDto)
  variants?: ProductVariantDto[];
}
