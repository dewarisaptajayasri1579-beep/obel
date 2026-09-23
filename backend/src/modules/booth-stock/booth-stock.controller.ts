import { Controller, Get, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { JwtPayload } from '../auth/jwt-payload.interface';
import { DomainError } from '../../common/domain-error';
import { BoothStockService } from './booth-stock.service';

@Controller('booth-stock')
@UseGuards(JwtAuthGuard, RolesGuard)
export class BoothStockController {
  constructor(private readonly boothStockService: BoothStockService) {}

  @Get()
  @Roles(UserRole.ADMIN, UserRole.OWNER)
  findAll() {
    return this.boothStockService.findAll();
  }

  @Get('mine')
  @Roles(UserRole.BOOTH_STAFF)
  findMine(@CurrentUser() user: JwtPayload) {
    if (!user.boothId) {
      throw new DomainError('NOT_CHECKED_IN', 'Anda belum check-in ke Booth manapun.');
    }
    return this.boothStockService.findAll(user.boothId);
  }
}
