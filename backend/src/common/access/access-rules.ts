import { AccessLevel, UserRole } from '@prisma/client';
import { MENU_KEYS, type MenuKey } from './menus';

/// Hak akses efektif seorang user di admin web (BR-044), dihitung dari DB tiap request.
/// - OWNER: Lihat di semua menu (read-only).
/// - ADMIN berperan sistem (fullAccess): Kelola di semua menu.
/// - ADMIN berperan biasa: sesuai izin perannya; tanpa peran: tidak ada.
/// - BOOTH_STAFF: di luar RBAC (kosong; aturannya tetap di @Roles & service).
export interface UserAccess {
  roleName: string | null;
  levels: Partial<Record<MenuKey, AccessLevel>>;
}

/// Aturan akses satu endpoint (lihat decorator di menu-access.decorator.ts).
export type AccessRule =
  | { kind: 'menu'; menus: MenuKey[]; level: AccessLevel }
  /// Data pendukung (dropdown/lookup) — boleh dibaca semua Admin & Owner tanpa izin menu.
  | { kind: 'lookup' }
  | { kind: 'ownerOnly' }
  /// Hak bergantung data (mis. role akun target) — guard meloloskan, service wajib memeriksa.
  | { kind: 'service' };

export function hitungAkses(
  role: UserRole,
  accessRole: { name: string; fullAccess: boolean; permissions: { menu: string; level: AccessLevel }[] } | null,
): UserAccess {
  const semua = (level: AccessLevel) => Object.fromEntries(MENU_KEYS.map((k) => [k, level])) as UserAccess['levels'];
  if (role === UserRole.OWNER) return { roleName: null, levels: semua(AccessLevel.VIEW) };
  if (role !== UserRole.ADMIN || !accessRole) return { roleName: null, levels: {} };
  if (accessRole.fullAccess) return { roleName: accessRole.name, levels: semua(AccessLevel.MANAGE) };
  const levels: UserAccess['levels'] = {};
  for (const p of accessRole.permissions) {
    if ((MENU_KEYS as readonly string[]).includes(p.menu)) levels[p.menu as MenuKey] = p.level;
  }
  return { roleName: accessRole.name, levels };
}

/// True kalau `access` punya level >= `level` di salah satu `menus`.
export function punyaAkses(access: UserAccess, menus: MenuKey[], level: AccessLevel): boolean {
  return menus.some((m) => {
    const dimiliki = access.levels[m];
    return dimiliki === AccessLevel.MANAGE || (level === AccessLevel.VIEW && dimiliki === AccessLevel.VIEW);
  });
}

/// Keputusan guard untuk ADMIN/OWNER (BOOTH_STAFF tidak lewat sini). `null` = boleh.
export function tolakAkses(
  role: UserRole,
  access: UserAccess,
  rule: AccessRule | undefined,
): { code: 'MENU_ACCESS_DENIED' | 'MENU_ACCESS_NOT_CONFIGURED'; menus?: MenuKey[]; level?: AccessLevel } | null {
  // Fail-closed: endpoint Admin/Owner tanpa aturan akses dianggap belum dikonfigurasi.
  if (!rule) return { code: 'MENU_ACCESS_NOT_CONFIGURED' };
  switch (rule.kind) {
    case 'lookup':
    case 'service':
      return null;
    case 'ownerOnly':
      return role === UserRole.OWNER ? null : { code: 'MENU_ACCESS_DENIED' };
    case 'menu':
      return punyaAkses(access, rule.menus, rule.level) ? null : { code: 'MENU_ACCESS_DENIED', menus: rule.menus, level: rule.level };
  }
}
