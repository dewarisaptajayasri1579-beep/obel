import { Controller, Get, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
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
}
