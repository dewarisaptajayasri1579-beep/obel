import { IsBoolean, IsOptional, IsUUID } from 'class-validator';

export class UpsertBoothShiftAssignmentDto {
  @IsUUID()
  boothId!: string;

  @IsUUID()
  shiftTemplateId!: string;

  /// Kosong/null berarti "belum ditugaskan" — bukan dihapus barisnya, cuma
  /// dikosongkan (memilih ulang nanti tidak perlu membuat baris baru).
  @IsOptional()
  @IsUUID()
  staffId?: string | null;

  /// Konfirmasi eksplisit dari Admin untuk tetap lanjut walau petugas yang
  /// sedang dipegang slot ini masih aktif shift (belum check-out) — lihat
  /// STAFF_SHIFT_ACTIVE di BoothShiftAssignmentsService.upsert(). Tanpa ini,
  /// perubahan/pengosongan slot itu ditolak dulu supaya Admin sadar dulu.
  @IsOptional()
  @IsBoolean()
  force?: boolean;
}
