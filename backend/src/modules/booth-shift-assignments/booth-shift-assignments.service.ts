import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { DomainError } from '../../common/domain-error';
import { SAFE_PROFILE_SELECT } from '../../common/safe-profile';
import { UpsertBoothShiftAssignmentDto } from './dto/upsert-booth-shift-assignment.dto';

@Injectable()
export class BoothShiftAssignmentsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.boothShiftAssignment.findMany({
      include: { staff: { select: SAFE_PROFILE_SELECT } },
    });
  }

  /// Dipakai layar Check-In (Android) untuk preview Booth/Shift yang bakal
  /// otomatis terpilih sebelum staff konfirmasi — null kalau belum
  /// ditugaskan sama sekali.
  findByStaffId(staffId: string) {
    return this.prisma.boothShiftAssignment.findUnique({
      where: { staffId },
      include: { booth: true, shiftTemplate: true },
    });
  }

  /// Auto-save dari Select di layar Setting Booth-Petugas — satu panggilan
  /// per perubahan pilihan, bukan simpan massal. `staffId` null berarti
  /// "belum ditugaskan" (dikosongkan, bukan menghapus barisnya).
  async upsert(dto: UpsertBoothShiftAssignmentDto) {
    /// Satu petugas cuma boleh dipegang SATU pasangan Booth+Shift total —
    /// bukan cuma "tidak boleh shift yang sama di Booth lain", tapi benar-benar
    /// satu slot saja di seluruh matriks (dijamin juga oleh `@unique` di
    /// `staffId` pada schema — ini cuma supaya pesan errornya jelas, bukan
    /// P2002 mentah dari Postgres). Sel yang sama (update ulang) dikecualikan
    /// lewat `NOT { boothId, shiftTemplateId }` sekaligus, bukan boothId saja.
    if (dto.staffId) {
      const bentrok = await this.prisma.boothShiftAssignment.findFirst({
        where: {
          staffId: dto.staffId,
          NOT: { boothId: dto.boothId, shiftTemplateId: dto.shiftTemplateId },
        },
        include: { booth: true, shiftTemplate: true, staff: { select: SAFE_PROFILE_SELECT } },
      });
      if (bentrok) {
        throw new DomainError(
          'STAFF_ALREADY_ASSIGNED',
          `${bentrok.staff?.fullName ?? 'Petugas ini'} sudah ditugaskan di Booth "${bentrok.booth.name}" / Shift "${bentrok.shiftTemplate.name}". Satu petugas cuma boleh satu Booth dan satu Shift — kosongkan penugasan itu dulu.`,
        );
      }
    }

    return this.prisma.boothShiftAssignment.upsert({
      where: { boothId_shiftTemplateId: { boothId: dto.boothId, shiftTemplateId: dto.shiftTemplateId } },
      create: { boothId: dto.boothId, shiftTemplateId: dto.shiftTemplateId, staffId: dto.staffId ?? null },
      update: { staffId: dto.staffId ?? null },
      include: { staff: { select: SAFE_PROFILE_SELECT } },
    });
  }
}
