import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { AccessLevel, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';
import { ActivityLogService } from '../../common/activity-log.service';
import { aksesDitolak, pastikanAkses } from '../../common/access/access-denied';
import { DomainError } from '../../common/domain-error';
import { SAFE_PROFILE_SELECT } from '../../common/safe-profile';
import type { AuthUser } from '../auth/jwt-payload.interface';
import { AssignAccessRoleDto } from './dto/assign-access-role.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateMyProfileDto } from './dto/update-my-profile.dto';

const SELECT_SAFE_FIELDS = {
  ...SAFE_PROFILE_SELECT,
  createdAt: true,
  accessRole: { select: { id: true, name: true } },
} as const;

/// Siapa boleh mengelola akun ber-role tertentu (BR-044): akun Barista lewat menu Barista,
/// akun Admin lewat menu User (atau Owner), akun Owner hanya oleh Owner.
function pastikanBolehKelolaAkun(actor: AuthUser, targetRole: UserRole) {
  if (targetRole === UserRole.OWNER) {
    if (actor.role !== UserRole.OWNER) throw aksesDitolak();
    return;
  }
  if (targetRole === UserRole.ADMIN) {
    if (actor.role !== UserRole.OWNER) pastikanAkses(actor, ['USER'], AccessLevel.MANAGE);
    return;
  }
  pastikanAkses(actor, ['BARISTA'], AccessLevel.MANAGE);
}

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activityLog: ActivityLogService,
  ) {}

  /// `defaultBoothId` (dipakai saat login, lihat AuthService) TIDAK sinkron
  /// dengan `BoothShiftAssignment` (roster Booth+Shift tetap per staff, diatur
  /// dari Booth → Setting Petugas, lihat BoothShiftAssignmentsService) — dua
  /// field/tabel yang beda tujuan. Halaman Petugas menampilkan status
  /// "sudah/belum ditugaskan" berdasarkan roster (`assignedBoothId`, dari
  /// BoothShiftAssignment), BUKAN `defaultBoothId`, karena roster itu yang
  /// jadi acuan operasional sebenarnya (dipakai ShiftsService.checkIn() utk
  /// nentuin Booth staff) — `defaultBoothId` kosong tidak berarti staff itu
  /// belum ditugaskan.
  async findAll() {
    const rows = await this.prisma.profile.findMany({
      select: { ...SELECT_SAFE_FIELDS, shiftAssignments: { select: { boothId: true } } },
      orderBy: { fullName: 'asc' },
    });
    return rows.map(({ shiftAssignments, ...rest }) => ({
      ...rest,
      assignedBoothId: shiftAssignments[0]?.boothId ?? null,
    }));
  }

  async create(dto: CreateUserDto, actor: AuthUser) {
    pastikanBolehKelolaAkun(actor, dto.role);
    const existing = await this.prisma.profile.findUnique({ where: { username: dto.username } });
    if (existing) {
      throw new ConflictException(`Username "${dto.username}" sudah dipakai.`);
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    return this.prisma.profile.create({
      data: {
        username: dto.username,
        passwordHash,
        fullName: dto.fullName,
        role: dto.role,
        defaultBoothId: dto.defaultBoothId,
      },
      select: SELECT_SAFE_FIELDS,
    });
  }

  async findMe(id: string) {
    const existing = await this.prisma.profile.findUnique({ where: { id }, select: SELECT_SAFE_FIELDS });
    if (!existing) {
      throw new NotFoundException('User tidak ditemukan.');
    }
    return existing;
  }

  async updateMe(id: string, dto: UpdateMyProfileDto) {
    const existing = await this.prisma.profile.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('User tidak ditemukan.');
    }
    return this.prisma.profile.update({
      where: { id },
      data: { fullName: dto.fullName },
      select: SELECT_SAFE_FIELDS,
    });
  }

  async update(id: string, dto: UpdateUserDto, actor: AuthUser) {
    const existing = await this.prisma.profile.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('User tidak ditemukan.');
    }
    pastikanBolehKelolaAkun(actor, existing.role);

    return this.prisma.profile.update({
      where: { id },
      data: {
        fullName: dto.fullName,
        defaultBoothId: dto.defaultBoothId,
        active: dto.active,
      },
      select: SELECT_SAFE_FIELDS,
    });
  }

  /// "Lupa password" ditangani lewat Admin (bukan self-service email/OTP —
  /// belum ada infra email di project ini). Admin Pusat mereset password
  /// user manapun dari halaman Master User.
  async resetPassword(id: string, dto: ResetPasswordDto, actor: AuthUser) {
    const existing = await this.prisma.profile.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('User tidak ditemukan.');
    }
    pastikanBolehKelolaAkun(actor, existing.role);

    const passwordHash = await bcrypt.hash(dto.newPassword, 10);
    return this.prisma.profile.update({
      where: { id },
      data: { passwordHash },
      select: SELECT_SAFE_FIELDS,
    });
  }

  /// Owner memasang/mencabut peran akses seorang Admin (BR-044). `accessRoleId: null` = tanpa peran
  /// (tidak bisa membuka menu apa pun). Berlaku di request berikutnya Admin itu (dibaca dari DB).
  async assignAccessRole(id: string, dto: AssignAccessRoleDto, actor: AuthUser) {
    const target = await this.prisma.profile.findUnique({ where: { id } });
    if (!target) throw new NotFoundException('User tidak ditemukan.');
    if (target.role !== UserRole.ADMIN) {
      throw new DomainError('ACCESS_ROLE_ADMIN_ONLY', 'Peran akses hanya bisa dipasang ke akun Admin.');
    }
    const peran = dto.accessRoleId ? await this.prisma.accessRole.findUnique({ where: { id: dto.accessRoleId } }) : null;
    if (dto.accessRoleId && !peran) throw new NotFoundException('Peran tidak ditemukan.');

    return this.prisma.$transaction(async (tx) => {
      const hasil = await tx.profile.update({
        where: { id },
        data: { accessRoleId: peran?.id ?? null },
        select: SELECT_SAFE_FIELDS,
      });
      await this.activityLog.record(tx, {
        entityType: 'profile',
        entityId: id,
        action: 'ASSIGN_ACCESS_ROLE',
        actorId: actor.sub,
        actorName: actor.fullName,
        note: peran ? `Peran: ${peran.name}` : 'Peran dicabut',
      });
      return hasil;
    });
  }
}
