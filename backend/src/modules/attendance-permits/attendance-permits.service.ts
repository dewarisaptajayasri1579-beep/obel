import { Injectable } from '@nestjs/common';
import { AttendancePermitType, AttendancePoint, Prisma, UserRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ActivityLogService } from '../../common/activity-log.service';
import { DomainError } from '../../common/domain-error';
import { SAFE_PROFILE_SELECT } from '../../common/safe-profile';
import { startOfDayJakarta, startOfTodayJakarta } from '../../common/jakarta-date';
import { JwtPayload } from '../auth/jwt-payload.interface';
import { GrantAttendancePermitDto } from './dto/grant-attendance-permit.dto';

const LABEL_TITIK: Record<AttendancePoint, string> = {
  DEPART: 'Berangkat (Gudang)',
  ARRIVE: 'Tiba (Booth)',
  FINISH: 'Selesai (Booth)',
  RETURN: 'Kembali (Gudang)',
};

/// Izin absen yang diberikan Admin langsung (BR-042) — Barista menghubungi Admin
/// (GPS meleset / pulang awal darurat), Admin memberi izin, Barista mengulang absen.
/// Berlaku hari itu saja dan dipakai sekali oleh absen yang cocok (ShiftsService).
@Injectable()
export class AttendancePermitsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activityLog: ActivityLogService,
  ) {}

  async grant(dto: GrantAttendancePermitDto, user: JwtPayload) {
    const staff = await this.prisma.profile.findUnique({ where: { id: dto.staffId } });
    if (!staff || staff.role !== UserRole.BOOTH_STAFF) {
      throw new DomainError('NOT_FOUND', 'Barista tidak ditemukan.');
    }
    const point = dto.type === AttendancePermitType.LOCATION ? dto.point! : null;
    return this.prisma.$transaction(async (tx) => {
      const permit = await tx.attendancePermit.create({
        data: {
          staffId: dto.staffId,
          type: dto.type,
          point,
          reason: dto.reason.trim(),
          grantedById: user.sub,
          businessDate: startOfTodayJakarta(),
        },
      });
      await this.activityLog.record(tx, {
        entityType: 'attendance_permit',
        entityId: permit.id,
        action: 'ATTENDANCE_PERMIT_GRANTED',
        actorId: user.sub,
        actorName: user.username,
        note: `${staff.fullName}: ${point ? `absen di luar radius — ${LABEL_TITIK[point]}` : 'Check-Out sebelum jam selesai'}. Alasan: ${permit.reason}`,
      });
      return permit;
    });
  }

  /// Riwayat izin satu hari (default hari ini, Asia/Jakarta).
  list(date?: Date) {
    return this.prisma.attendancePermit.findMany({
      where: { businessDate: startOfDayJakarta(date ?? new Date()) },
      include: { staff: { select: SAFE_PROFILE_SELECT }, grantedBy: { select: SAFE_PROFILE_SELECT } },
      orderBy: { grantedAt: 'desc' },
    });
  }

  /// Izin hari ini yang belum terpakai untuk absen ini (paling lama dulu).
  cariIzin(staffId: string, type: AttendancePermitType, point: AttendancePoint | null) {
    return this.prisma.attendancePermit.findFirst({
      where: { staffId, type, point, businessDate: startOfTodayJakarta(), usedAt: null },
      orderBy: { grantedAt: 'asc' },
    });
  }

  /// Menandai izin terpakai — dipanggil di dalam transaksi absen yang memakainya.
  async pakai(tx: Prisma.TransactionClient, permitId: string, shiftSessionId: string) {
    await tx.attendancePermit.update({ where: { id: permitId }, data: { usedAt: new Date(), usedShiftSessionId: shiftSessionId } });
  }
}
