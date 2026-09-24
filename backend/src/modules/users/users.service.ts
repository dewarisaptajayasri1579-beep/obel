import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';
import { SAFE_PROFILE_SELECT } from '../../common/safe-profile';
import { CreateUserDto } from './dto/create-user.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateMyProfileDto } from './dto/update-my-profile.dto';

const SELECT_SAFE_FIELDS = { ...SAFE_PROFILE_SELECT, createdAt: true } as const;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

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

  async create(dto: CreateUserDto) {
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

  async update(id: string, dto: UpdateUserDto) {
    const existing = await this.prisma.profile.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('User tidak ditemukan.');
    }

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
  async resetPassword(id: string, dto: ResetPasswordDto) {
    const existing = await this.prisma.profile.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('User tidak ditemukan.');
    }

    const passwordHash = await bcrypt.hash(dto.newPassword, 10);
    return this.prisma.profile.update({
      where: { id },
      data: { passwordHash },
      select: SELECT_SAFE_FIELDS,
    });
  }
}
