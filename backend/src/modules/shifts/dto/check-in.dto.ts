import { IsOptional, IsUUID } from 'class-validator';

export class CheckInDto {
  /// Override manual — kosong berarti pakai Booth dari BoothShiftAssignment
  /// milik staff yang login.
  @IsOptional()
  @IsUUID()
  boothId?: string;
}
