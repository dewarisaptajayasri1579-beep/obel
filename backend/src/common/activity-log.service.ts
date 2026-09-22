import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface RecordActivityInput {
  entityType: string;
  entityId: string;
  action: string;
  actorId: string;
  actorName: string;
  note?: string;
}

/// Satu-satunya pintu tulis `activity_logs`. Lihat "Aturan Soft Delete & Log
/// Aktivitas" di AGENTS.md — setiap aksi bermakna pada satu entitas (dibuat,
/// diubah, dihapus-lunak, disetujui, dst) WAJIB tercatat lewat ini.
///
/// Terima `tx` opsional supaya bisa dipanggil di dalam transaksi domain yang
/// sama (biasanya begitu — log harus commit bersama aksinya, bukan menyusul
/// terpisah dan bisa hilang kalau aksinya rollback), atau langsung
/// `this.prisma` untuk aksi yang memang tidak butuh transaksi.
@Injectable()
export class ActivityLogService {
  constructor(private readonly prisma: PrismaService) {}

  async record(client: Prisma.TransactionClient | PrismaService, input: RecordActivityInput) {
    await client.activityLog.create({
      data: {
        entityType: input.entityType,
        entityId: input.entityId,
        action: input.action,
        actorId: input.actorId,
        actorName: input.actorName,
        note: input.note,
      },
    });
  }

  /// Riwayat satu entitas, terbaru dulu — dipakai panel "Riwayat Aktivitas"
  /// di halaman detail dokumen apa pun.
  findForEntity(entityType: string, entityId: string) {
    return this.prisma.activityLog.findMany({
      where: { entityType, entityId },
      orderBy: { occurredAt: 'desc' },
    });
  }
}
