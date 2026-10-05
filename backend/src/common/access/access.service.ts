import { Injectable } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { hitungAkses, type UserAccess } from './access-rules';

/// Select relasi peran yang dibutuhkan hitungAkses() — dipakai di sini & saat login.
export const ACCESS_ROLE_SELECT = {
  select: { name: true, fullAccess: true, permissions: { select: { menu: true, level: true } } },
} as const;

export interface ResolvedUser {
  role: UserRole;
  fullName: string;
  access: UserAccess;
}

/// Membaca role, status aktif, dan peran akses user dari DB — dipanggil tiap request (JwtStrategy)
/// dan saat koneksi WebSocket, supaya pencabutan akses/nonaktif berlaku LANGSUNG, bukan setelah
/// token kedaluwarsa (BR-044).
@Injectable()
export class AccessService {
  constructor(private readonly prisma: PrismaService) {}

  /// `null` kalau user tidak ada atau nonaktif.
  async resolve(profileId: string): Promise<ResolvedUser | null> {
    const profile = await this.prisma.profile.findUnique({
      where: { id: profileId },
      select: {
        role: true,
        fullName: true,
        active: true,
        accessRole: ACCESS_ROLE_SELECT,
      },
    });
    if (!profile || !profile.active) return null;
    return { role: profile.role, fullName: profile.fullName, access: hitungAkses(profile.role, profile.accessRole) };
  }
}
