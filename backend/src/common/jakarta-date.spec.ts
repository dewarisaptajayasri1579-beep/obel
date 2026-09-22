import {
  businessDateKeyJakarta,
  combineJakartaDateAndTime,
  minutesSinceMidnightJakarta,
  startOfDayJakarta,
} from './jakarta-date';

/// AC-24 (docs/15-testing-acceptance-criteria.md): transaksi mendekati
/// tengah malam harus dikelompokkan ke business date Asia/Jakarta (UTC+7)
/// yang benar, bukan tanggal UTC. Tidak bisa dites lewat e2e karena server
/// selalu memakai `new Date()` (waktu asli) — di sinilah unit test pada
/// fungsi murni jadi satu-satunya cara mengontrol titik waktu ujiannya.
describe('jakarta-date', () => {
  it('businessDateKeyJakarta rolls over at Jakarta midnight, not UTC midnight', () => {
    // 2026-03-04 23:00 UTC == 2026-03-05 06:00 Jakarta (UTC+7) — still UTC's
    // 03-04, but Jakarta's 03-05.
    const beforeUtcMidnight = new Date('2026-03-04T23:00:00.000Z');
    expect(businessDateKeyJakarta(beforeUtcMidnight)).toBe('2026-03-05');

    // 2026-03-04 16:59:59 UTC == 2026-03-04 23:59:59 Jakarta — one second
    // before the Jakarta day rolls over.
    const justBeforeJakartaMidnight = new Date('2026-03-04T16:59:59.000Z');
    expect(businessDateKeyJakarta(justBeforeJakartaMidnight)).toBe('2026-03-04');

    // 2026-03-04 17:00:00 UTC == 2026-03-05 00:00:00 Jakarta exactly.
    const atJakartaMidnight = new Date('2026-03-04T17:00:00.000Z');
    expect(businessDateKeyJakarta(atJakartaMidnight)).toBe('2026-03-05');
  });

  it('startOfDayJakarta returns the UTC instant of 00:00 Jakarta time, regardless of input time-of-day', () => {
    const morning = new Date('2026-03-05T01:00:00.000Z'); // 08:00 Jakarta
    const night = new Date('2026-03-05T16:00:00.000Z'); // 23:00 Jakarta
    expect(startOfDayJakarta(morning).toISOString()).toBe('2026-03-04T17:00:00.000Z');
    expect(startOfDayJakarta(night).toISOString()).toBe('2026-03-04T17:00:00.000Z');
  });

  it('minutesSinceMidnightJakarta converts UTC instants to Jakarta wall-clock minutes', () => {
    expect(minutesSinceMidnightJakarta(new Date('2026-03-05T01:00:00.000Z'))).toBe(8 * 60); // 08:00 Jakarta
    expect(minutesSinceMidnightJakarta(new Date('2026-03-05T00:30:00.000Z'))).toBe(7 * 60 + 30); // 07:30 Jakarta
    expect(minutesSinceMidnightJakarta(new Date('2026-03-04T17:00:00.000Z'))).toBe(0); // 00:00 Jakarta
  });

  it('combineJakartaDateAndTime combines a Jakarta business date with an "HH:mm" time', () => {
    const businessDate = startOfDayJakarta(new Date('2026-03-05T01:00:00.000Z')); // 2026-03-05 Jakarta
    expect(combineJakartaDateAndTime(businessDate, '08:00').toISOString()).toBe(
      '2026-03-05T01:00:00.000Z',
    );
    expect(combineJakartaDateAndTime(businessDate, '16:30').toISOString()).toBe(
      '2026-03-05T09:30:00.000Z',
    );
  });
});
