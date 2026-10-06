import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ActivityLogService } from '../../common/activity-log.service';
import { DomainError } from '../../common/domain-error';
import { PrismaService } from '../../prisma/prisma.service';
import type { AuthUser } from '../auth/jwt-payload.interface';
import { SaveAccessRoleDto } from './dto/save-access-role.dto';

const INCLUDE = {
  permissions: { select: { menu: true, level: true } },
  _count: { select: { profiles: true } },
} as const;

/// Peran hak akses Admin (BR-044). Hanya Owner yang membuat/mengubah/menghapus; peran sistem
/// (fullAccess, "Akses Penuh") tidak bisa diubah/dihapus; peran yang masih dipakai tidak bisa dihapus.
@Injectable()
export class AccessRolesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activityLog: ActivityLogService,
  ) {}

  findAll() {
    return this.prisma.accessRole.findMany({
      include: INCLUDE,
      orderBy: [{ fullAccess: 'desc' }, { name: 'asc' }],
    });
  }

  async create(dto: SaveAccessRoleDto, actor: AuthUser) {
    const data = await this.validasi(dto);
    return this.prisma.$transaction(async (tx) => {
      const peran = await tx.accessRole.create({
        data: { name: data.name, description: data.description, permissions: { create: data.permissions } },
        include: INCLUDE,
      });
      await this.catat(tx, peran.id, 'CREATE', actor, peran.name);
      return peran;
    });
  }

  async update(id: string, dto: SaveAccessRoleDto, actor: AuthUser) {
    await this.ambilBisaDiubah(id);
    const data = await this.validasi(dto, id);
    return this.prisma.$transaction(async (tx) => {
      await tx.accessRolePermission.deleteMany({ where: { accessRoleId: id } });
      const peran = await tx.accessRole.update({
        where: { id },
        data: { name: data.name, description: data.description ?? null, permissions: { create: data.permissions } },
        include: INCLUDE,
      });
      await this.catat(tx, id, 'UPDATE', actor, peran.name);
      return peran;
    });
  }

  /// Peran = konfigurasi, bukan transaksi posted — boleh dihapus selama tidak dipakai siapa pun.
  async remove(id: string, actor: AuthUser) {
    const peran = await this.ambilBisaDiubah(id);
    if (peran._count.profiles > 0) {
      throw new DomainError('ACCESS_ROLE_IN_USE', `Peran "${peran.name}" masih dipakai ${peran._count.profiles} Admin. Pindahkan dulu ke peran lain.`, {
        users: peran._count.profiles,
      });
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.accessRole.delete({ where: { id } });
      await this.catat(tx, id, 'DELETE', actor, peran.name);
    });
    return { id };
  }

  private async ambilBisaDiubah(id: string) {
    const peran = await this.prisma.accessRole.findUnique({ where: { id }, include: INCLUDE });
    if (!peran) throw new NotFoundException('Peran tidak ditemukan.');
    if (peran.fullAccess) {
      throw new DomainError('ACCESS_ROLE_SYSTEM', `Peran sistem "${peran.name}" tidak bisa diubah atau dihapus.`);
    }
    return peran;
  }

  private async validasi(dto: SaveAccessRoleDto, idSendiri?: string) {
    const name = dto.name.trim().replace(/\s+/g, ' ');
    const kembar = await this.prisma.accessRole.findFirst({
      where: { name: { equals: name, mode: 'insensitive' }, ...(idSendiri ? { id: { not: idSendiri } } : {}) },
    });
    if (kembar) throw new DomainError('ACCESS_ROLE_NAME_TAKEN', `Nama peran "${kembar.name}" sudah dipakai.`);
    const menus = dto.permissions.map((p) => p.menu);
    if (new Set(menus).size !== menus.length) {
      throw new DomainError('ACCESS_ROLE_DUPLICATE_MENU', 'Satu menu hanya boleh muncul sekali di daftar izin.');
    }
    return { name, description: dto.description?.trim() || undefined, permissions: dto.permissions.map((p) => ({ menu: p.menu, level: p.level })) };
  }

  private catat(tx: Prisma.TransactionClient, id: string, action: string, actor: AuthUser, nama: string) {
    return this.activityLog.record(tx, {
      entityType: 'access_role',
      entityId: id,
      action,
      actorId: actor.sub,
      actorName: actor.fullName,
      note: `Peran: ${nama}`,
    });
  }
}
