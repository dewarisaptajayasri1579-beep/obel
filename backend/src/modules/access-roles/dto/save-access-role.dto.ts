import { Type } from 'class-transformer';
import { AccessLevel } from '@prisma/client';
import { IsArray, IsEnum, IsIn, IsOptional, IsString, MaxLength, MinLength, ValidateNested } from 'class-validator';
import { MENU_KEYS, type MenuKey } from '../../../common/access/menus';

export class AccessRolePermissionDto {
  @IsIn(MENU_KEYS as readonly string[])
  menu!: MenuKey;

  @IsEnum(AccessLevel)
  level!: AccessLevel;
}

/// Buat/ubah peran (BR-044). `permissions` = daftar LENGKAP izin peran (menggantikan yang lama);
/// menu yang tidak disebut = Tidak ada.
export class SaveAccessRoleDto {
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  description?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AccessRolePermissionDto)
  permissions!: AccessRolePermissionDto[];
}
