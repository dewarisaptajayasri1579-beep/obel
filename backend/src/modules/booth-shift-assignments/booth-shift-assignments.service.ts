import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
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

  /// Auto-save dari Select di layar Setting Booth-Petugas — satu panggilan
  /// per perubahan pilihan, bukan simpan massal. `staffId` null berarti
  /// "belum ditugaskan" (dikosongkan, bukan menghapus barisnya).
  upsert(dto: UpsertBoothShiftAssignmentDto) {
    return this.prisma.boothShiftAssignment.upsert({
      where: { boothId_shiftTemplateId: { boothId: dto.boothId, shiftTemplateId: dto.shiftTemplateId } },
      create: { boothId: dto.boothId, shiftTemplateId: dto.shiftTemplateId, staffId: dto.staffId ?? null },
      update: { staffId: dto.staffId ?? null },
      include: { staff: { select: SAFE_PROFILE_SELECT } },
    });
  }
}
