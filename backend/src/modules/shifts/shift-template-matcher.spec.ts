import { resolveActiveShiftTemplate } from './shift-template-matcher';

const SHIFT_1 = { id: 'shift-1', startTime: '08:00', endTime: '16:30' };
const SHIFT_2 = { id: 'shift-2', startTime: '16:30', endTime: '22:00' };

function atJakarta(hhmm: string): Date {
  const [hours, minutes] = hhmm.split(':').map(Number);
  // Jakarta = UTC+7, so "HH:mm Jakarta" on an arbitrary fixed date is
  // "HH-7:mm UTC" the same day (or the previous UTC day for early hours).
  return new Date(Date.UTC(2026, 2, 5, hours - 7, minutes));
}

describe('resolveActiveShiftTemplate', () => {
  it('matches exactly at startTime', () => {
    expect(resolveActiveShiftTemplate(atJakarta('08:00'), [SHIFT_1, SHIFT_2])?.id).toBe(
      'shift-1',
    );
  });

  it('matches inside the grace window before startTime', () => {
    expect(resolveActiveShiftTemplate(atJakarta('07:15'), [SHIFT_1, SHIFT_2])?.id).toBe(
      'shift-1',
    );
  });

  it('matches at the endTime boundary (inclusive)', () => {
    // Isolated to one template so the back-to-back-shift tie-break (below)
    // doesn't interfere: this only checks endTime itself is inclusive.
    expect(resolveActiveShiftTemplate(atJakarta('16:30'), [SHIFT_1])?.id).toBe('shift-1');
  });

  it('at a shift boundary shared with the next shift, prefers the incoming shift', () => {
    // SHIFT_2's grace window starts at 15:30, well inside SHIFT_1's own
    // 08:00-16:30 range, so at the exact 16:30 boundary both match — this
    // is intentional: someone checking in right at the handover moment is
    // almost always starting the *next* shift, not backfilling the one
    // that's ending, so "closest start" resolves in favor of SHIFT_2 here.
    expect(resolveActiveShiftTemplate(atJakarta('16:30'), [SHIFT_1, SHIFT_2])?.id).toBe(
      'shift-2',
    );
  });

  it('does not match before the grace window', () => {
    expect(resolveActiveShiftTemplate(atJakarta('06:59'), [SHIFT_1, SHIFT_2])).toBeNull();
  });

  it('returns null when no templates are active', () => {
    expect(resolveActiveShiftTemplate(atJakarta('12:00'), [])).toBeNull();
  });

  it('returns null when now falls in a gap between shifts', () => {
    // 16:29 is after Shift 1's grace-adjusted window? Shift 1 ends 16:30, so
    // this should still match Shift 1 (inclusive end), not fall in a gap.
    // Use a genuine gap example instead: nothing scheduled before 07:00.
    expect(resolveActiveShiftTemplate(atJakarta('01:00'), [SHIFT_1, SHIFT_2])).toBeNull();
  });

  it('picks the closest-starting template when two overlap', () => {
    const overlapping = { id: 'shift-overlap', startTime: '08:15', endTime: '16:00' };
    // At 08:10, both SHIFT_1 (grace-adjusted range 07:00-16:30) and
    // "overlapping" (grace-adjusted range 07:15-16:00) match. Distance to
    // startTime: SHIFT_1 is |08:10 - 08:00| = 10min, "overlapping" is
    // |08:10 - 08:15| = 5min — "overlapping" is closer, so it wins.
    expect(
      resolveActiveShiftTemplate(atJakarta('08:10'), [SHIFT_1, overlapping])?.id,
    ).toBe('shift-overlap');
  });
});
