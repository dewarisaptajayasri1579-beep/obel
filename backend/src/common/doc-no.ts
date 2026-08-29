import { randomUUID } from 'crypto';

/// Nomor dokumen manusiawi (sale_no, movement_no, distribution_no, dst).
/// Bukan sequential — unik cukup diandalkan lewat kombinasi timestamp+random,
/// dan tetap dijaga oleh unique constraint di kolomnya masing-masing.
export function generateDocNo(prefix: string): string {
  const stamp = Date.now().toString(36).toUpperCase();
  const suffix = randomUUID().slice(0, 6).toUpperCase();
  return `${prefix}-${stamp}-${suffix}`;
}
