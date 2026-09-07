import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';
import { SAFE_PROFILE_SELECT } from '../../common/safe-profile';
import { CreateUserDto } from './dto/create-user.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';

const SELECT_SAFE_FIELDS = { ...SAFE_PROFILE_SELECT, createdAt: true } as const;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.profile.findMany({
      select: SELECT_SAFE_FIELDS,
      orderBy: { fullName: 'asc' },
    });
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
