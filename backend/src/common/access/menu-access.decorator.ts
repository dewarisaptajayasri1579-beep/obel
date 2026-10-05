import { SetMetadata } from '@nestjs/common';
import { AccessLevel } from '@prisma/client';
import type { AccessRule } from './access-rules';
import type { MenuKey } from './menus';

export const ACCESS_RULE_KEY = 'accessRule';

/// Endpoint milik menu admin web: butuh `level` (Lihat/Kelola) di salah satu menu itu (BR-044).
/// Dipasang di method atau class; method menimpa class. Hanya berlaku utk ADMIN/OWNER.
export const Menu = (menus: MenuKey | MenuKey[], level: AccessLevel) =>
  SetMetadata<string, AccessRule>(ACCESS_RULE_KEY, { kind: 'menu', menus: Array.isArray(menus) ? menus : [menus], level });

/// Data pendukung (daftar untuk dropdown/filter) — boleh dibaca semua Admin & Owner.
export const Lookup = () => SetMetadata<string, AccessRule>(ACCESS_RULE_KEY, { kind: 'lookup' });

/// Hanya Owner (mis. mengatur peran).
export const OwnerOnly = () => SetMetadata<string, AccessRule>(ACCESS_RULE_KEY, { kind: 'ownerOnly' });

/// Hak bergantung data (mis. role akun target) — service WAJIB memeriksa sendiri.
export const AccessCheckedInService = () => SetMetadata<string, AccessRule>(ACCESS_RULE_KEY, { kind: 'service' });
