import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { JwtPayload } from '../auth/jwt-payload.interface';
import { CreateStockAdjustmentDto, ReverseStockAdjustmentDto } from './dto/create-stock-adjustment.dto';
import { StockAdjustmentsService } from './stock-adjustments.service';

@Controller('stock-adjustments')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class StockAdjustmentsController {
  constructor(private readonly stockAdjustmentsService: StockAdjustmentsService) {}

  @Get()
  findAll() {
    return this.stockAdjustmentsService.findAll();
  }

  @Post()
  create(@Body() dto: CreateStockAdjustmentDto, @CurrentUser() user: JwtPayload) {
    return this.stockAdjustmentsService.create(dto, user);
  }

  @Post(':id/reverse')
  reverse(@Param('id') id: string, @Body() dto: ReverseStockAdjustmentDto, @CurrentUser() user: JwtPayload) {
    return this.stockAdjustmentsService.reverse(id, dto, user);
  }
}
