import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { JwtPayload } from '../auth/jwt-payload.interface';
import { CancelDistributionDto, CorrectReceiptDto, ReviseDistributionDto } from '../distributions/dto/correction.dto';
import { ReceiveDistributionDto } from '../distributions/dto/receive-distribution.dto';
import { ApproveRestockRequestDto } from '../restock-requests/dto/approve-restock-request.dto';
import { RejectRestockRequestDto } from '../restock-requests/dto/reject-restock-request.dto';
import { CreateStockHandoverDto } from './dto/create-stock-handover.dto';
import { StockHandoversService } from './stock-handovers.service';

@Controller('stock-handovers')
@UseGuards(JwtAuthGuard, RolesGuard)
export class StockHandoversController {
  constructor(private readonly stockHandoversService: StockHandoversService) {}

  @Get()
  @Roles(UserRole.ADMIN, UserRole.OWNER)
  findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('status') status?: 'DIAJUKAN' | 'DIPROSES' | 'DITERIMA' | 'DITOLAK' | 'DIBATALKAN',
    @Query('boothId') boothId?: string,
  ) {
    return this.stockHandoversService.findAll({
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      search: search || undefined,
      status: status || undefined,
      boothId: boothId || undefined,
    });
  }

  @Get('in-transit')
  @Roles(UserRole.ADMIN, UserRole.OWNER)
  findInTransitSummary() {
    return this.stockHandoversService.findInTransitSummary();
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.OWNER)
  findOne(@Param('id') id: string) {
    return this.stockHandoversService.findOne(id);
  }

  @Get(':id/activity-log')
  @Roles(UserRole.ADMIN, UserRole.OWNER)
  findActivityLog(@Param('id') id: string) {
    return this.stockHandoversService.findActivityLog(id);
  }

  @Post()
  @Roles(UserRole.ADMIN)
  create(@Body() dto: CreateStockHandoverDto, @CurrentUser() user: JwtPayload) {
    return this.stockHandoversService.create(dto, user.sub, user.username);
  }

  @Post(':id/approve')
  @Roles(UserRole.ADMIN)
  approve(@Param('id') id: string, @Body() dto: ApproveRestockRequestDto, @CurrentUser() user: JwtPayload) {
    return this.stockHandoversService.approve(id, dto, user.sub, user.username);
  }

  @Post(':id/reject')
  @Roles(UserRole.ADMIN)
  reject(@Param('id') id: string, @Body() dto: RejectRestockRequestDto, @CurrentUser() user: JwtPayload) {
    return this.stockHandoversService.reject(id, dto, user.sub, user.username);
  }

  @Post(':id/receive')
  @Roles(UserRole.BOOTH_STAFF, UserRole.ADMIN)
  receive(@Param('id') id: string, @Body() dto: ReceiveDistributionDto, @CurrentUser() user: JwtPayload) {
    return this.stockHandoversService.receive(id, dto, user);
  }

  @Post(':id/cancel')
  @Roles(UserRole.ADMIN)
  cancel(@Param('id') id: string, @Body() dto: CancelDistributionDto, @CurrentUser() user: JwtPayload) {
    return this.stockHandoversService.cancel(id, dto, user);
  }

  @Post(':id/revise')
  @Roles(UserRole.ADMIN)
  revise(@Param('id') id: string, @Body() dto: ReviseDistributionDto, @CurrentUser() user: JwtPayload) {
    return this.stockHandoversService.revise(id, dto, user);
  }

  @Post(':id/correct-receipt')
  @Roles(UserRole.ADMIN)
  correctReceipt(@Param('id') id: string, @Body() dto: CorrectReceiptDto, @CurrentUser() user: JwtPayload) {
    return this.stockHandoversService.correctReceipt(id, dto, user);
  }
}
