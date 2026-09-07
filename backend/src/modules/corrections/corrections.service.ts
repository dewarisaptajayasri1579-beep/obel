import { Injectable } from '@nestjs/common';
import { CorrectionType, Prisma, ReasonCode } from '@prisma/client';
import { randomUUID } from 'crypto';
import { DomainError } from '../../common/domain-error';
import { reasonRequiresNote } from '../../common/reason-code';
import { SAFE_PROFILE_SELECT } from '../../common/safe-profile';
import { PrismaService } from '../../prisma/prisma.service';

export interface RecordCorrectionInput {
  entityType: string;
  entityId: string;
  transactionGroupId: string;
  correctionType: CorrectionType;
  originalVersionId?: string | null;
  replacementVersionId?: string | null;
  reasonCode: ReasonCode;
  reasonNote?: string | null;
  impactSnapshot: Record<string, unknown>;
  createdById: string;
  idempotencyKey: string;
}

/// Writer generik untuk `transaction_corrections`, per
/// docs/obbel-coffee-ai-docs/24-data-consistency-correction-reversal.md §13.
/// Setiap domain correction (void/revise sale, cancel/revise distribution,
/// dst.) memanggil `record()` di dalam `$transaction` yang sama dengan efek
/// domainnya sendiri, sehingga audit row dan efek bisnis selalu atomik.
@Injectable()
export class CorrectionsService {
  constructor(private readonly prisma: PrismaService) {}

  validateReason(reasonCode: ReasonCode, reasonNote?: string | null) {
    if (reasonRequiresNote(reasonCode) && !reasonNote?.trim()) {
      throw new DomainError('REASON_NOTE_REQUIRED', 'Catatan wajib diisi untuk alasan "Lainnya".');
    }
  }

  /// Cek idempotency SEBELUM masuk ke $transaction domain — dipanggil oleh
  /// service pemanggil di awal method public-nya (pola sama dengan
  /// distributions.service.ts create()).
  async findExistingByIdempotencyKey(idempotencyKey: string) {
    return this.prisma.transactionCorrection.findUnique({ where: { idempotencyKey } });
  }

  /// Riwayat & Koreksi Data (05-feature-specification.md §B10) — daftar
  /// seluruh correction lintas entity, terbaru dulu. `entityId` adalah UUID
  /// mentah; endpoint ini melampirkan `entityLabel` (nomor dokumen manusiawi
  /// seperti saleNo/distributionNo) supaya Admin bisa cari berdasarkan
  /// nomor transaksi, bukan UUID.
  async findAll() {
    const corrections = await this.prisma.transactionCorrection.findMany({
      include: { createdBy: { select: SAFE_PROFILE_SELECT } },
      orderBy: { createdAt: 'desc' },
      take: 300,
    });

    const idsByType = new Map<string, Set<string>>();
    for (const c of corrections) {
      if (!idsByType.has(c.entityType)) idsByType.set(c.entityType, new Set());
      idsByType.get(c.entityType)!.add(c.entityId);
      // Untuk revisi, replacementVersionId juga perlu dilabeli (versi baru).
      if (c.replacementVersionId) idsByType.get(c.entityType)!.add(c.replacementVersionId);
    }

    const labelById = new Map<string, string>();

    const [sales, distributions, returns, opnames, restockRequests, shiftSessions] = await Promise.all([
      idsByType.has('sale')
        ? this.prisma.sale.findMany({ where: { id: { in: [...idsByType.get('sale')!] } }, select: { id: true, saleNo: true } })
        : [],
      idsByType.has('stock_distribution')
        ? this.prisma.stockDistribution.findMany({ where: { id: { in: [...idsByType.get('stock_distribution')!] } }, select: { id: true, distributionNo: true } })
        : [],
      idsByType.has('stock_return')
        ? this.prisma.stockReturn.findMany({ where: { id: { in: [...idsByType.get('stock_return')!] } }, select: { id: true, returnNo: true } })
        : [],
      idsByType.has('stock_opname')
        ? this.prisma.stockOpname.findMany({ where: { id: { in: [...idsByType.get('stock_opname')!] } }, select: { id: true, opnameNo: true } })
        : [],
      idsByType.has('restock_request')
        ? this.prisma.restockRequest.findMany({ where: { id: { in: [...idsByType.get('restock_request')!] } }, select: { id: true, requestNo: true } })
        : [],
      idsByType.has('shift_session')
        ? this.prisma.shiftSession.findMany({
            where: { id: { in: [...idsByType.get('shift_session')!] } },
            select: { id: true, booth: { select: { name: true } }, businessDate: true },
          })
        : [],
    ]);

    for (const s of sales) labelById.set(s.id, s.saleNo);
    for (const d of distributions) labelById.set(d.id, d.distributionNo);
    for (const r of returns) labelById.set(r.id, r.returnNo);
    for (const o of opnames) labelById.set(o.id, o.opnameNo);
    for (const rr of restockRequests) labelById.set(rr.id, rr.requestNo);
    for (const s of shiftSessions) {
      labelById.set(s.id, `${s.booth.name} — ${s.businessDate.toISOString().slice(0, 10)}`);
    }

    return corrections.map((c) => ({
      ...c,
      entityLabel: labelById.get(c.entityId) ?? labelById.get(c.replacementVersionId ?? '') ?? null,
    }));
  }

  async record(tx: Prisma.TransactionClient, input: RecordCorrectionInput) {
    return tx.transactionCorrection.create({
      data: {
        id: randomUUID(),
        entityType: input.entityType,
        entityId: input.entityId,
        transactionGroupId: input.transactionGroupId,
        correctionType: input.correctionType,
        originalVersionId: input.originalVersionId ?? null,
        replacementVersionId: input.replacementVersionId ?? null,
        reasonCode: input.reasonCode,
        reasonNote: input.reasonNote ?? null,
        impactSnapshot: input.impactSnapshot as Prisma.InputJsonValue,
        status: 'POSTED',
        createdById: input.createdById,
        postedAt: new Date(),
        idempotencyKey: input.idempotencyKey,
      },
    });
  }
}
