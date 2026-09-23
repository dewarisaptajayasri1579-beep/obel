import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsLatitude,
  IsLongitude,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class ConfirmClosingItemDto {
  @IsUUID()
  productId!: string;

  @IsInt()
  @Min(0)
  actualQty!: number;

  @IsOptional()
  @IsString()
  reasonCode?: string;

  @IsOptional()
  @IsString()
  reasonNote?: string;
}

export class ConfirmClosingDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ConfirmClosingItemDto)
  items!: ConfirmClosingItemDto[];

  /// GPS + foto selfie diambil saat Check-Out ("Absen Pulang") — sama pola
  /// soft-check dgn Check-In, lihat ShiftsService.computeLocationWarning.
  @IsLatitude()
  checkOutLatitude!: number;

  @IsLongitude()
  checkOutLongitude!: number;

  @IsString()
  @MinLength(1)
  checkOutPhotoUrl!: string;
}
