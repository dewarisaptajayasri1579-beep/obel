import { IsOptional, IsUUID } from 'class-validator';

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
}
