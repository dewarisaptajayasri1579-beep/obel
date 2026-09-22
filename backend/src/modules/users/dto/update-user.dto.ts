import { IsBoolean, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';

/// Username & role SENGAJA tidak bisa diubah lewat sini — username sudah jadi
/// identitas login yang dipakai petugas, dan mengganti role akun yang sedang
/// dipakai berisiko mengubah cakupan akses di tengah sesi aktifnya. Kalau role
/// benar-benar perlu berubah, buat akun baru.
export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  fullName?: string;

  @IsOptional()
  @IsUUID()
  defaultBoothId?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
