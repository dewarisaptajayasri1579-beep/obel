import { Injectable } from '@nestjs/common';
import { AttendancePermitStatus, AttendancePermitType, AttendancePoint, Prisma, ShiftStatus, UserRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ActivityLogService } from '../../common/activity-log.service';
import { DomainError } from '../../common/domain-error';
import { SAFE_PROFILE_SELECT } from '../../common/safe-profile';
import { businessDateOf } from '../../common/jakarta-date';
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
          businessDate: businessDateOf(new Date()),
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
      where: { businessDate: businessDateOf(date ?? new Date()) },
      include: { staff: { select: SAFE_PROFILE_SELECT }, grantedBy: { select: SAFE_PROFILE_SELECT } },
      orderBy: { grantedAt: 'desc' },
    });
  }

  /// Izin hari ini yang berlaku (GRANTED) dan belum terpakai untuk absen ini (paling lama dulu).
  cariIzin(staffId: string, type: AttendancePermitType, point: AttendancePoint | null) {
    return this.prisma.attendancePermit.findFirst({
      where: { staffId, type, point, businessDate: businessDateOf(new Date()), usedAt: null, status: AttendancePermitStatus.GRANTED },
      orderBy: { grantedAt: 'asc' },
    });
  }

  /// Barista mengajukan pulang cepat dari layar Check-Out (B4). Idempotent: pengajuan yang masih
  /// menunggu atau izin yang belum terpakai hari ini dikembalikan apa adanya.
  async requestEarlyCheckout(user: JwtPayload, reason: string) {
    const shift = await this.prisma.shiftSession.findFirst({ where: { staffId: user.sub, status: ShiftStatus.OPEN } });
    if (!shift) {
      throw new DomainError('SHIFT_NOT_OPEN', 'Pengajuan pulang cepat hanya untuk shift yang sedang berjalan.');
    }
    const businessDate = businessDateOf(new Date());
    const ada = await this.prisma.attendancePermit.findFirst({
      where: {
        staffId: user.sub,
        type: AttendancePermitType.EARLY_CHECKOUT,
        businessDate,
        usedAt: null,
        status: { in: [AttendancePermitStatus.REQUESTED, AttendancePermitStatus.GRANTED] },
      },
    });
    if (ada) return ada;

    try {
      return await this.prisma.$transaction(async (tx) => {
        const permit = await tx.attendancePermit.create({
          data: {
            staffId: user.sub,
            type: AttendancePermitType.EARLY_CHECKOUT,
            reason: reason.trim(),
            status: AttendancePermitStatus.REQUESTED,
            businessDate,
          },
        });
        await this.activityLog.record(tx, {
          entityType: 'attendance_permit',
          entityId: permit.id,
          action: 'EARLY_CHECKOUT_REQUESTED',
          actorId: user.sub,
          actorName: user.username,
          note: `Mengajukan Check-Out sebelum jam selesai. Alasan: ${permit.reason}`,
        });
        return permit;
      });
    } catch (err) {
      // Tap ganda: index unik parsial (satu pengajuan menunggu per Barista per hari).
      if (!(err instanceof Prisma.PrismaClientKnownRequestError) || err.code !== 'P2002') throw err;
      return this.prisma.attendancePermit.findFirstOrThrow({
        where: { staffId: user.sub, businessDate, status: AttendancePermitStatus.REQUESTED },
      });
    }
  }

  /// Pengajuan pulang cepat Barista hari ini yang terakhir (null kalau belum pernah mengajukan).
  findMyEarlyCheckout(user: JwtPayload) {
    return this.prisma.attendancePermit.findFirst({
      where: { staffId: user.sub, type: AttendancePermitType.EARLY_CHECKOUT, businessDate: businessDateOf(new Date()), usedAt: null },
      orderBy: { grantedAt: 'desc' },
    });
  }

  /// Admin menyetujui atau menolak pengajuan pulang cepat. Hanya pengajuan yang masih menunggu;
  /// dua Admin yang memutuskan bersamaan tidak saling menimpa.
  async decideEarlyCheckout(id: string, approve: boolean, user: JwtPayload, rejectReason?: string) {
    return this.prisma.$transaction(async (tx) => {
      const permit = await tx.attendancePermit.findUnique({ where: { id }, include: { staff: { select: { fullName: true } } } });
      if (!permit || permit.type !== AttendancePermitType.EARLY_CHECKOUT) {
        throw new DomainError('NOT_FOUND', 'Pengajuan tidak ditemukan.');
      }
      const diputuskan = await tx.attendancePermit.updateMany({
        where: { id, status: AttendancePermitStatus.REQUESTED },
        data: {
          status: approve ? AttendancePermitStatus.GRANTED : AttendancePermitStatus.REJECTED,
          grantedById: user.sub,
          decidedAt: new Date(),
          rejectReason: approve ? null : rejectReason?.trim(),
        },
      });
      if (diputuskan.count !== 1) {
        throw new DomainError('PERMIT_ALREADY_DECIDED', 'Pengajuan ini sudah diputuskan.');
      }
      await this.activityLog.record(tx, {
        entityType: 'attendance_permit',
        entityId: id,
        action: approve ? 'EARLY_CHECKOUT_APPROVED' : 'EARLY_CHECKOUT_REJECTED',
        actorId: user.sub,
        actorName: user.username,
        note: approve
          ? `Menyetujui pulang cepat ${permit.staff.fullName}.`
          : `Menolak pulang cepat ${permit.staff.fullName}. Alasan: ${rejectReason?.trim()}`,
      });
      return tx.attendancePermit.findUniqueOrThrow({ where: { id } });
    });
  }

  /// Menandai izin terpakai — dipanggil di dalam transaksi absen yang memakainya.
  async pakai(tx: Prisma.TransactionClient, permitId: string, shiftSessionId: string) {
    await tx.attendancePermit.update({ where: { id: permitId }, data: { usedAt: new Date(), usedShiftSessionId: shiftSessionId } });
  }
}
