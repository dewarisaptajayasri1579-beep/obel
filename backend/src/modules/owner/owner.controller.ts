import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { OwnerService } from './owner.service';

@Controller('owner')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.OWNER, UserRole.ADMIN)
export class OwnerController {
  constructor(private readonly ownerService: OwnerService) {}

  @Get('dashboard')
  getExecutiveHome() {
    return this.ownerService.getExecutiveHome();
  }

  @Get('booth-ranking')
  getBoothRanking(@Query('period') period?: 'today' | '7d' | 'month') {
    return this.ownerService.getBoothRanking(period ?? 'today');
  }

  @Get('booths/:id')
  getBoothDetail(@Param('id') id: string) {
    return this.ownerService.getBoothDetail(id);
  }

  @Get('stock-condition')
  getStockCondition() {
    return this.ownerService.getStockCondition();
  }

  @Get('discrepancy')
  getDiscrepancy() {
    return this.ownerService.getDiscrepancy();
  }
}
