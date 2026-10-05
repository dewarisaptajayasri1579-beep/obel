import { HttpStatus } from '@nestjs/common';
import { AccessLevel } from '@prisma/client';
import { DomainError } from '../domain-error';
import { punyaAkses, type UserAccess } from './access-rules';
import { MENUS, type MenuKey } from './menus';

/// 403 `MENU_ACCESS_DENIED` dengan nama menu yang dibutuhkan (BR-044).
export function aksesDitolak(menus?: MenuKey[], level?: AccessLevel): DomainError {
  const label = menus?.map((k) => MENUS.find((m) => m.key === k)?.label ?? k).join(' / ');
  return new DomainError(
    'MENU_ACCESS_DENIED',
    label
      ? `Anda tidak punya akses ${level === AccessLevel.MANAGE ? 'Kelola' : 'Lihat'} di menu ${label}.`
      : 'Anda tidak punya akses untuk aksi ini.',
    { menus, level },
    HttpStatus.FORBIDDEN,
  );
}

/// Pemeriksaan di service untuk endpoint `@AccessCheckedInService()` (hak bergantung data).
export function pastikanAkses(user: { access: UserAccess }, menus: MenuKey[], level: AccessLevel): void {
  if (!punyaAkses(user.access, menus, level)) throw aksesDitolak(menus, level);
}
