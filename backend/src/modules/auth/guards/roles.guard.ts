import { CanActivate, ExecutionContext, HttpStatus, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@prisma/client';
import { aksesDitolak } from '../../../common/access/access-denied';
import { tolakAkses, type AccessRule } from '../../../common/access/access-rules';
import { ACCESS_RULE_KEY } from '../../../common/access/menu-access.decorator';
import { DomainError } from '../../../common/domain-error';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { AuthUser } from '../jwt-payload.interface';

/// Enforces role checks at the service boundary — this is the application-layer
/// authorization called out in AGENTS.md as the replacement for Postgres RLS.
/// Untuk ADMIN/OWNER juga memeriksa hak akses menu (BR-044) dari `@Menu`/`@Lookup`/
/// `@OwnerOnly`/`@AccessCheckedInService` — endpoint tanpa aturan itu DITOLAK (fail-closed).
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const targets = [context.getHandler(), context.getClass()];
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, targets);
    const user = context.switchToHttp().getRequest().user as AuthUser | undefined;
    if (!user) return false;
    if (requiredRoles && requiredRoles.length > 0 && !requiredRoles.includes(user.role)) return false;
    if (user.role === UserRole.BOOTH_STAFF) return true;

    const rule = this.reflector.getAllAndOverride<AccessRule | undefined>(ACCESS_RULE_KEY, targets);
    const tolak = tolakAkses(user.role, user.access, rule);
    if (!tolak) return true;
    if (tolak.code === 'MENU_ACCESS_NOT_CONFIGURED') {
      throw new DomainError(tolak.code, 'Hak akses endpoint ini belum diatur.', undefined, HttpStatus.FORBIDDEN);
    }
    throw aksesDitolak(tolak.menus, tolak.level);
  }
}
