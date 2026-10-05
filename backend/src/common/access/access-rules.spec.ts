import { AccessLevel, UserRole } from '@prisma/client';
import { hitungAkses, punyaAkses, tolakAkses } from './access-rules';
import { MENU_KEYS } from './menus';

const peran = (permissions: { menu: string; level: AccessLevel }[], fullAccess = false) => ({ name: 'Uji', fullAccess, permissions });

describe('access rules (BR-044)', () => {
  it('gives Owner View on every menu and nothing to manage', () => {
    const akses = hitungAkses(UserRole.OWNER, null);
    expect(Object.keys(akses.levels)).toEqual([...MENU_KEYS]);
    expect(punyaAkses(akses, ['KASIR'], AccessLevel.VIEW)).toBe(true);
    expect(punyaAkses(akses, ['KASIR'], AccessLevel.MANAGE)).toBe(false);
  });

  it('gives the system role Manage on every menu, a normal role only its rows, no role nothing', () => {
    expect(punyaAkses(hitungAkses(UserRole.ADMIN, peran([], true)), ['USER'], AccessLevel.MANAGE)).toBe(true);
    const biasa = hitungAkses(UserRole.ADMIN, peran([
      { menu: 'KASIR', level: AccessLevel.VIEW },
      { menu: 'PEMUSNAHAN_STOK', level: AccessLevel.MANAGE },
      { menu: 'MENU_LAMA_DIHAPUS', level: AccessLevel.MANAGE },
    ]));
    expect(biasa.levels).toEqual({ KASIR: AccessLevel.VIEW, PEMUSNAHAN_STOK: AccessLevel.MANAGE });
    expect(punyaAkses(biasa, ['KASIR'], AccessLevel.MANAGE)).toBe(false);
    expect(punyaAkses(biasa, ['PEMUSNAHAN_STOK'], AccessLevel.VIEW)).toBe(true);
    expect(punyaAkses(biasa, ['DASHBOARD', 'KASIR'], AccessLevel.VIEW)).toBe(true);
    expect(hitungAkses(UserRole.ADMIN, null).levels).toEqual({});
    expect(hitungAkses(UserRole.BOOTH_STAFF, peran([], true)).levels).toEqual({});
  });

  it('fails closed without a rule and applies lookup, owner-only and menu rules', () => {
    const admin = hitungAkses(UserRole.ADMIN, peran([{ menu: 'KASIR', level: AccessLevel.VIEW }]));
    expect(tolakAkses(UserRole.ADMIN, admin, undefined)?.code).toBe('MENU_ACCESS_NOT_CONFIGURED');
    expect(tolakAkses(UserRole.ADMIN, admin, { kind: 'lookup' })).toBeNull();
    expect(tolakAkses(UserRole.ADMIN, admin, { kind: 'service' })).toBeNull();
    expect(tolakAkses(UserRole.ADMIN, admin, { kind: 'ownerOnly' })?.code).toBe('MENU_ACCESS_DENIED');
    expect(tolakAkses(UserRole.OWNER, hitungAkses(UserRole.OWNER, null), { kind: 'ownerOnly' })).toBeNull();
    expect(tolakAkses(UserRole.ADMIN, admin, { kind: 'menu', menus: ['KASIR'], level: AccessLevel.VIEW })).toBeNull();
    expect(tolakAkses(UserRole.ADMIN, admin, { kind: 'menu', menus: ['KASIR'], level: AccessLevel.MANAGE })).toEqual({
      code: 'MENU_ACCESS_DENIED',
      menus: ['KASIR'],
      level: AccessLevel.MANAGE,
    });
  });
});
