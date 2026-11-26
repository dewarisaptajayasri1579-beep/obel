import { IsLatitude, IsLongitude, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';

/// Absen Berangkat di Gudang. Booth dan shift bawaan dari roster (Setting Barista); Barista boleh
/// menggantinya di sini, dan Barista tanpa roster wajib memilih keduanya. Booth masih bisa diganti
/// lagi saat Absen Tiba.
export class CheckInDto {
  /// GPS + foto selfie absen Berangkat — divalidasi radius terhadap Gudang
  /// (ShiftsService.periksaLokasi, BR-042).
  @IsLatitude()
  latitude!: number;

  @IsLongitude()
  longitude!: number;

  @IsString()
  @MinLength(1)
  photoUrl!: string;

  /// Kosong = booth roster.
  @IsOptional()
  @IsUUID()
  boothId?: string;

  /// Kosong = shift bawaan (roster, atau shift berikutnya bila hari ini sudah selesai satu shift).
  @IsOptional()
  @IsUUID()
  shiftTemplateId?: string;
}
