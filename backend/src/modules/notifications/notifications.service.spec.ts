import { AccessLevel } from '@prisma/client';
import { canSeeNotification } from './notifications.service';

describe('canSeeNotification', () => {
  const access = (levels: Record<string, AccessLevel>) => ({ roleName: 'x', levels });

  it('shows an item only when its menu can be viewed', () => {
    const a = access({ SERAH_TERIMA_STOK: AccessLevel.VIEW });
    expect(canSeeNotification(a, 'pending:distributions')).toBe(true);
    expect(canSeeNotification(a, 'pending:restock')).toBe(true);
    expect(canSeeNotification(a, 'lowstock:booth-1')).toBe(false);
    expect(canSeeNotification(a, 'reconciliation:abc')).toBe(false);
    expect(canSeeNotification(access({ DASHBOARD: AccessLevel.MANAGE }), 'reconciliation:abc')).toBe(true);
  });

  it('hides unknown kinds and everything for an admin without a role', () => {
    expect(canSeeNotification(access({ DASHBOARD: AccessLevel.MANAGE }), 'something-new:1')).toBe(false);
    expect(canSeeNotification(access({}), 'pending:approve')).toBe(false);
  });
});
