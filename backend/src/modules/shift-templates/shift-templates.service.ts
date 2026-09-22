import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { DomainError } from '../../common/domain-error';
import { CreateShiftTemplateDto } from './dto/create-shift-template.dto';
import { UpdateShiftTemplateDto } from './dto/update-shift-template.dto';

@Injectable()
export class ShiftTemplatesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.shiftTemplate.findMany({ orderBy: { startTime: 'asc' } });
  }

  create(dto: CreateShiftTemplateDto) {
    return this.prisma.shiftTemplate.create({
      data: { name: dto.name, startTime: dto.startTime, endTime: dto.endTime },
    });
  }

  async update(id: string, dto: UpdateShiftTemplateDto) {
    const existing = await this.prisma.shiftTemplate.findUnique({ where: { id } });
    if (!existing) {
      throw new DomainError('NOT_FOUND', 'Template Shift tidak ditemukan.');
    }

    return this.prisma.shiftTemplate.update({
      where: { id },
      data: { name: dto.name, startTime: dto.startTime, endTime: dto.endTime, active: dto.active },
    });
  }

  /// Hard delete — TANPA soft delete, beda dari Product/Booth, karena
  /// ShiftTemplate murni master data konfigurasi (nama & jam), tidak pernah
  /// ditampilkan sendirian di nota/laporan histori (yang tampil di sana
  /// adalah snapshot `ShiftSession`, bukan template-nya). Tetap DITOLAK kalau
  /// masih dipakai `ShiftSession` (jadwal shift yang pernah/sedang berjalan)
  /// atau `BoothShiftAssignment` (Setting Booth-Petugas) — arahkan ke
  /// Nonaktifkan.
  async remove(id: string) {
    const template = await this.prisma.shiftTemplate.findUnique({ where: { id } });
    if (!template) {
      throw new DomainError('NOT_FOUND', 'Template Shift tidak ditemukan.');
    }

    const [sessionCount, assignmentCount] = await Promise.all([
      this.prisma.shiftSession.count({ where: { shiftTemplateId: id } }),
      this.prisma.boothShiftAssignment.count({ where: { shiftTemplateId: id } }),
    ]);

    if (sessionCount > 0 || assignmentCount > 0) {
      throw new DomainError(
        'SHIFT_TEMPLATE_IN_USE',
        `Template "${template.name}" tidak bisa dihapus karena masih dipakai ${sessionCount} shift session dan ${assignmentCount} Setting Booth-Petugas. Gunakan Nonaktifkan.`,
        { sessionCount, assignmentCount },
      );
    }

    await this.prisma.shiftTemplate.delete({ where: { id } });
    return { id, deleted: true };
  }
}
