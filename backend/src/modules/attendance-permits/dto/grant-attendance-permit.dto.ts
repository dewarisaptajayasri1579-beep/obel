import { AttendancePermitType, AttendancePoint } from '@prisma/client';
import { IsEnum, IsString, IsUUID, MinLength, ValidateIf } from 'class-validator';

/// Izin absen dari Admin (BR-042), berlaku hari ini saja dan dipakai sekali.
export class GrantAttendancePermitDto {
  @IsUUID()
  staffId!: string;

  @IsEnum(AttendancePermitType)
  type!: AttendancePermitType;

  /// Wajib untuk izin LOCATION: titik absen mana yang boleh di luar radius.
  @ValidateIf((o) => o.type === AttendancePermitType.LOCATION)
  @IsEnum(AttendancePoint)
  point?: AttendancePoint;

  @IsString()
  @MinLength(3)
  reason!: string;
}
