import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { JwtPayload } from '../auth/jwt-payload.interface';
import { AdjustWarehouseStockDto } from './dto/adjust-warehouse-stock.dto';
import { WarehouseStockService } from './warehouse-stock.service';

@Controller('warehouse-stock')
@UseGuards(JwtAuthGuard, RolesGuard)
export class WarehouseStockController {
  constructor(private readonly warehouseStockService: WarehouseStockService) {}

  @Get()
  @Roles(UserRole.ADMIN, UserRole.OWNER)
  findAll() {
    return this.warehouseStockService.findAll();
  }

  @Post('adjust')
  @Roles(UserRole.ADMIN)
  adjust(@Body() dto: AdjustWarehouseStockDto, @CurrentUser() user: JwtPayload) {
    return this.warehouseStockService.adjust(dto, user.sub);
  }
}
