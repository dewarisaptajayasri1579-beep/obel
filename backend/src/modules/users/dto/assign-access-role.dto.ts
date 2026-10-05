import { IsUUID, ValidateIf } from 'class-validator';

export class AssignAccessRoleDto {
  /// `null` = cabut peran (Admin tanpa akses menu).
  @ValidateIf((_o, v) => v !== null)
  @IsUUID()
  accessRoleId!: string | null;
}
