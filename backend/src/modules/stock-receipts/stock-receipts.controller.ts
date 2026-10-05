import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { StockReceiptStatus, UserRole, AccessLevel } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/jwt-payload.interface';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CreateStockReceiptDto } from './dto/create-stock-receipt.dto';
import { UpdateStockReceiptDto } from './dto/update-stock-receipt.dto';
import { StockReceiptsService } from './stock-receipts.service';
import { ActivityLogService } from '../../common/activity-log.service';
import { Menu } from '../../common/access/menu-access.decorator';

/// Tambah Stok Gudang. Admin membuat & mengelola; Owner cuma baca.
@Controller('stock-receipts')
@UseGuards(JwtAuthGuard, RolesGuard)
export class StockReceiptsController {
  constructor(
    private readonly service: StockReceiptsService,
    private readonly activityLog: ActivityLogService,
  ) {}

  @Get()
  @Menu('TAMBAH_STOK_GUDANG', AccessLevel.VIEW)
  @Roles(UserRole.ADMIN, UserRole.OWNER)
  findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('status') status?: StockReceiptStatus,
  ) {
    return this.service.findAll({
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      search: search || undefined,
      status: status || undefined,
    });
  }

  @Get(':id')
  @Menu('TAMBAH_STOK_GUDANG', AccessLevel.VIEW)
  @Roles(UserRole.ADMIN, UserRole.OWNER)
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Get(':id/activity-log')
  @Menu('TAMBAH_STOK_GUDANG', AccessLevel.VIEW)
  @Roles(UserRole.ADMIN, UserRole.OWNER)
  activityLogFor(@Param('id') id: string) {
    return this.activityLog.findForEntity('stock_receipt', id);
  }

  @Post()
  @Menu('TAMBAH_STOK_GUDANG', AccessLevel.MANAGE)
  @Roles(UserRole.ADMIN)
  create(@Body() dto: CreateStockReceiptDto, @CurrentUser() user: JwtPayload) {
    return this.service.create(dto, user.sub, user.username);
  }

  @Patch(':id')
  @Menu('TAMBAH_STOK_GUDANG', AccessLevel.MANAGE)
  @Roles(UserRole.ADMIN)
  update(@Param('id') id: string, @Body() dto: UpdateStockReceiptDto, @CurrentUser() user: JwtPayload) {
    return this.service.update(id, dto, user.sub, user.username);
  }

  @Patch(':id/post')
  @Menu('TAMBAH_STOK_GUDANG', AccessLevel.MANAGE)
  @Roles(UserRole.ADMIN)
  post(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.service.post(id, user.sub, user.username);
  }

  @Post(':id/revise')
  @Menu('TAMBAH_STOK_GUDANG', AccessLevel.MANAGE)
  @Roles(UserRole.ADMIN)
  revise(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.service.startRevision(id, user.sub, user.username);
  }

  @Delete(':id')
  @Menu('TAMBAH_STOK_GUDANG', AccessLevel.MANAGE)
  @Roles(UserRole.ADMIN)
  @HttpCode(204)
  async remove(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    await this.service.remove(id, user.sub, user.username);
  }
}
