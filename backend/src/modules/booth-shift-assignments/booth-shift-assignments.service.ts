import { Injectable } from '@nestjs/common';
import { ShiftStatus } from '@prisma/client';
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
    /// Satu petugas cuma boleh dipegang SATU pasangan Booth+Shift total (`@unique` di
    /// `staffId`). Barista yang sudah di slot lain boleh dipindah setelah Admin
    /// mengonfirmasi (`reassign`): slot lamanya dikosongkan di transaksi yang sama.
    /// Sel yang sama (update ulang) dikecualikan lewat `NOT { boothId, shiftTemplateId }`.
    let slotLama: { id: string } | null = null;
    if (dto.staffId) {
      const bentrok = await this.prisma.boothShiftAssignment.findFirst({
        where: {
          staffId: dto.staffId,
          NOT: { boothId: dto.boothId, shiftTemplateId: dto.shiftTemplateId },
        },
        include: { booth: true, shiftTemplate: true, staff: { select: SAFE_PROFILE_SELECT } },
      });
      if (bentrok && !dto.reassign) {
        throw new DomainError(
          'STAFF_ALREADY_ASSIGNED',
          `${bentrok.staff?.fullName ?? 'Barista ini'} sudah ditugaskan di ${bentrok.booth.name} · ${bentrok.shiftTemplate.name}. Pindahkan? Penugasan lamanya dilepas.`,
          { staffName: bentrok.staff?.fullName ?? null, boothName: bentrok.booth.name, shiftName: bentrok.shiftTemplate.name },
        );
      }
      slotLama = bentrok;
    }

    /// Slot ini lagi dipegang siapa SEBELUM perubahan — kalau petugas itu mau
    /// diganti/dikosongkan padahal dia masih aktif shift (belum check-out),
    /// tolak dulu kecuali Admin sudah eksplisit konfirmasi lewat `force`.
    /// Tanpa ini, ganti/hapus penugasan diam-diam meninggalkan ShiftSession
    /// yang tetap OPEN padahal rosternya sudah tidak menyebut dia lagi —
    /// persis kasus yang bikin staff "kelihatan belum ditugaskan" padahal
    /// baru saja berhasil check-in.
    const slotSaatIni = await this.prisma.boothShiftAssignment.findUnique({
      where: { boothId_shiftTemplateId: { boothId: dto.boothId, shiftTemplateId: dto.shiftTemplateId } },
    });
    const staffLama = slotSaatIni?.staffId;
    if (staffLama && staffLama !== dto.staffId && !dto.force) {
      const shiftAktif = await this.prisma.shiftSession.findFirst({
        where: { staffId: staffLama, status: { in: [ShiftStatus.OPEN, ShiftStatus.CLOSING] } },
        include: { booth: true, staff: { select: SAFE_PROFILE_SELECT } },
        orderBy: { openedAt: 'desc' },
      });
      if (shiftAktif) {
        throw new DomainError(
          'STAFF_SHIFT_ACTIVE',
          `${shiftAktif.staff.fullName} masih aktif shift di Booth "${shiftAktif.booth.name}" sejak ${shiftAktif.openedAt?.toISOString()} (belum check-out). Mengubah penugasan ini tidak akan check-out dia otomatis — lanjutkan?`,
          { staffId: staffLama, staffName: shiftAktif.staff.fullName, boothName: shiftAktif.booth.name, openedAt: shiftAktif.openedAt },
        );
      }
    }

    return this.prisma.$transaction(async (tx) => {
      // Lepas dulu slot lama: staffId unik, slot baru tidak bisa diisi selama yang lama masih memegangnya.
      if (slotLama) await tx.boothShiftAssignment.update({ where: { id: slotLama.id }, data: { staffId: null } });
      return tx.boothShiftAssignment.upsert({
        where: { boothId_shiftTemplateId: { boothId: dto.boothId, shiftTemplateId: dto.shiftTemplateId } },
        create: { boothId: dto.boothId, shiftTemplateId: dto.shiftTemplateId, staffId: dto.staffId ?? null },
        update: { staffId: dto.staffId ?? null },
        include: { staff: { select: SAFE_PROFILE_SELECT } },
      });
    });
  }
}
