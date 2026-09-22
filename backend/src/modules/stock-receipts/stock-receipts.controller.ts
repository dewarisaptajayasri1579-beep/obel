import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/jwt-payload.interface';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CreateStockReceiptDto } from './dto/create-stock-receipt.dto';
import { UpdateStockReceiptDto } from './dto/update-stock-receipt.dto';
import { StockReceiptsService } from './stock-receipts.service';

/// Tambah Stok Gudang. Admin membuat & mengelola; Owner cuma baca.
@Controller('stock-receipts')
@UseGuards(JwtAuthGuard, RolesGuard)
export class StockReceiptsController {
  constructor(private readonly service: StockReceiptsService) {}

  @Get()
  @Roles(UserRole.ADMIN, UserRole.OWNER)
  findAll() {
    return this.service.findAll();
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.OWNER)
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @Roles(UserRole.ADMIN)
  create(@Body() dto: CreateStockReceiptDto, @CurrentUser() user: JwtPayload) {
    return this.service.create(dto, user.sub, user.username);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN)
  update(@Param('id') id: string, @Body() dto: UpdateStockReceiptDto, @CurrentUser() user: JwtPayload) {
    return this.service.update(id, dto, user.sub, user.username);
  }

  @Patch(':id/post')
  @Roles(UserRole.ADMIN)
  post(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.service.post(id, user.sub, user.username);
  }

  @Post(':id/revise')
  @Roles(UserRole.ADMIN)
  revise(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.service.startRevision(id, user.sub, user.username);
  }
}
