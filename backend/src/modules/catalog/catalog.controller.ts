import { BadRequestException, Controller, Get, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { JwtPayload } from '../auth/jwt-payload.interface';
import { CatalogService } from './catalog.service';

@Controller('catalog')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.BOOTH_STAFF)
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  @Get()
  getCatalog(@CurrentUser() user: JwtPayload) {
    // Always derive booth from the authenticated session — never trust a
    // client-supplied booth_id (BR: Booth Staff scoping, 03-users-roles-permissions.md).
    if (!user.boothId) {
      throw new BadRequestException('User belum memiliki assignment booth.');
    }
    return this.catalogService.getBoothCatalog(user.boothId);
  }
}
