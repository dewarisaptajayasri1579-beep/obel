import { ShiftTemplate } from '@prisma/client';
import { minutesSinceMidnightJakarta } from '../../common/jakarta-date';

/// Berapa menit sebelum ShiftTemplate.startTime resmi seorang Petugas masih
/// boleh check-in (mis. siap-siap/terima stok sebelum shift resmi mulai —
/// lihat docsV2/07-siklus-shift.md §3).
export const CHECK_IN_GRACE_MINUTES = 60;

function parseHHMMToMinutes(hhmm: string): number {
  const [hours, minutes] = hhmm.split(':').map(Number);
  return hours * 60 + minutes;
}

/// Fungsi murni (tidak menyentuh Prisma/Nest) supaya bisa di-unit-test
/// terisolasi. Dipakai oleh ShiftsService.checkIn() untuk menentukan
/// ShiftTemplate mana yang berlaku "sekarang" tanpa Petugas harus memilih
/// sendiri (Booth Staff tidak punya akses baca ke /shift-templates).
export function resolveActiveShiftTemplate(
  now: Date,
  templates: Pick<ShiftTemplate, 'id' | 'startTime' | 'endTime'>[],
): Pick<ShiftTemplate, 'id' | 'startTime' | 'endTime'> | null {
  const nowMinutes = minutesSinceMidnightJakarta(now);

  const matches = templates.filter((t) => {
    const start = parseHHMMToMinutes(t.startTime) - CHECK_IN_GRACE_MINUTES;
    const end = parseHHMMToMinutes(t.endTime);
    return nowMinutes >= start && nowMinutes <= end;
  });

  if (matches.length === 0) return null;
  if (matches.length === 1) return matches[0];

  // Overlap antar template (harusnya jarang) — pilih yang startTime-nya
  // paling dekat ke waktu sekarang, deterministik.
  return matches.reduce((closest, candidate) => {
    const closestDelta = Math.abs(nowMinutes - parseHHMMToMinutes(closest.startTime));
    const candidateDelta = Math.abs(nowMinutes - parseHHMMToMinutes(candidate.startTime));
    return candidateDelta < closestDelta ? candidate : closest;
  });
}
