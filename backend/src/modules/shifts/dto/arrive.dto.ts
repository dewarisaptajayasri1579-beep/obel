import { IsOptional, IsUUID } from 'class-validator';
import { AttendanceDto } from './attendance.dto';

/// Absen Tiba: booth tempat Barista benar-benar bertugas. Kosong = booth shift saat ini (roster).
/// Booth lain: lokasi dicek terhadap booth itu dan stok yang dibawa ikut pindah.
export class ArriveDto extends AttendanceDto {
  @IsOptional()
  @IsUUID()
  boothId?: string;
}
