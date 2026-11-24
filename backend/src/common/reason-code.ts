import { ReasonCode } from '@prisma/client';

export const REASON_CODES = Object.values(ReasonCode);

/// docs/spec/24-data-consistency-correction-reversal.md §10: "Jika OTHER, note wajib."
export function reasonRequiresNote(reasonCode: ReasonCode): boolean {
  return reasonCode === ReasonCode.OTHER;
}
