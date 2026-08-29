import { Injectable } from '@nestjs/common';
import { CorrectionType, Prisma, ReasonCode } from '@prisma/client';
import { randomUUID } from 'crypto';
import { DomainError } from '../../common/domain-error';
import { reasonRequiresNote } from '../../common/reason-code';
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
  /// seluruh correction lintas entity, terbaru dulu.
  findAll() {
    return this.prisma.transactionCorrection.findMany({
      include: { createdBy: true },
      orderBy: { createdAt: 'desc' },
      take: 300,
    });
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
