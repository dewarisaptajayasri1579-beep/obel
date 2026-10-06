import { IsEnum, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';
import { UserRole } from '@prisma/client';

export class CreateUserDto {
  @IsString()
  @MinLength(3)
  username!: string;

  @IsString()
  @MinLength(6)
  password!: string;

  @IsString()
  @MinLength(1)
  fullName!: string;

  @IsEnum(UserRole)
  role!: UserRole;

  @IsOptional()
  @IsUUID()
  defaultBoothId?: string;

  /// Peran akses untuk akun Admin baru (BR-044). Hanya Owner yang boleh mengisinya.
  @IsOptional()
  @IsUUID()
  accessRoleId?: string;
}
