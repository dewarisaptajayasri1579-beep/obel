import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { AccessLevel, UserRole } from '@prisma/client';
import { Lookup, Menu, OwnerOnly } from '../../common/access/menu-access.decorator';
import { MENUS } from '../../common/access/menus';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { AuthUser } from '../auth/jwt-payload.interface';
import { AccessRolesService } from './access-roles.service';
import { SaveAccessRoleDto } from './dto/save-access-role.dto';

/// Peran & Hak Akses (BR-044) — dikelola Owner; Admin dgn Lihat User boleh membaca daftarnya.
@Controller('access-roles')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AccessRolesController {
  constructor(private readonly accessRoles: AccessRolesService) {}

  @Get()
  @Menu('USER', AccessLevel.VIEW)
  @Roles(UserRole.ADMIN, UserRole.OWNER)
  findAll() {
    return this.accessRoles.findAll();
  }

  /// Katalog menu yang bisa diatur — satu sumber dgn backend (src/common/access/menus.ts).
  @Get('menus')
  @Lookup()
  @Roles(UserRole.ADMIN, UserRole.OWNER)
  menus() {
    return MENUS;
  }

  @Post()
  @OwnerOnly()
  @Roles(UserRole.OWNER)
  create(@Body() dto: SaveAccessRoleDto, @CurrentUser() user: AuthUser) {
    return this.accessRoles.create(dto, user);
  }

  @Patch(':id')
  @OwnerOnly()
  @Roles(UserRole.OWNER)
  update(@Param('id') id: string, @Body() dto: SaveAccessRoleDto, @CurrentUser() user: AuthUser) {
    return this.accessRoles.update(id, dto, user);
  }

  @Delete(':id')
  @OwnerOnly()
  @Roles(UserRole.OWNER)
  remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.accessRoles.remove(id, user);
  }
}
