import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UpdateAppSettingsDto } from './dto/update-app-settings.dto';

const DEFAULT_ID = 'default';

/// Pengaturan global aplikasi — SATU baris singleton, pola identik dengan
/// CompanyProfileService (upsert + lazy-create saat pertama diminta).
@Injectable()
export class AppSettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async get() {
    const existing = await this.prisma.appSettings.findUnique({ where: { id: DEFAULT_ID } });
    if (existing) return existing;
    return this.prisma.appSettings.create({ data: { id: DEFAULT_ID } });
  }

  async update(dto: UpdateAppSettingsDto) {
    return this.prisma.appSettings.upsert({
      where: { id: DEFAULT_ID },
      create: { id: DEFAULT_ID, gpsPingIntervalSeconds: dto.gpsPingIntervalSeconds },
      update: { gpsPingIntervalSeconds: dto.gpsPingIntervalSeconds },
    });
  }
}
