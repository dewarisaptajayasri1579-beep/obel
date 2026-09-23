import { Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { JwtPayload } from '../auth/jwt-payload.interface';
import { DomainError } from '../../common/domain-error';
import { CreateSaleDto } from './dto/create-sale.dto';
import { CreateDraftSaleDto } from './dto/create-draft-sale.dto';
import { PayDraftSaleDto } from './dto/pay-draft-sale.dto';
import { ReviseSaleDto, RevisePaymentDto } from './dto/revise-sale.dto';
import { VoidSaleDto } from './dto/void-sale.dto';
import { CreateRefundDto } from './dto/create-refund.dto';
import { SalesService } from './sales.service';

@Controller('sales')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SalesController {
  constructor(private readonly salesService: SalesService) {}

  @Get()
  @Roles(UserRole.ADMIN, UserRole.OWNER, UserRole.BOOTH_STAFF)
  findAll(@CurrentUser() user: JwtPayload) {
    return this.salesService.findAll(user);
  }

  @Post()
  @Roles(UserRole.BOOTH_STAFF, UserRole.ADMIN)
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateSaleDto) {
    return this.salesService.createPaidSale(user, dto);
  }

  @Post('draft')
  @Roles(UserRole.BOOTH_STAFF)
  createDraft(@CurrentUser() user: JwtPayload, @Body() dto: CreateDraftSaleDto) {
    return this.salesService.createDraftSale(user, dto);
  }

  /// Rute statis 'drafts' HARUS didaftarkan sebelum ':id' di bawah, sama
  /// alasannya dengan 'me' di users.controller.ts.
  @Get('drafts')
  @Roles(UserRole.BOOTH_STAFF)
  listDrafts(@CurrentUser() user: JwtPayload) {
    if (!user.boothId) {
      throw new DomainError('NOT_CHECKED_IN', 'Anda belum check-in ke Booth manapun.');
    }
    return this.salesService.listDrafts(user.boothId);
  }

  @Post(':id/pay')
  @Roles(UserRole.BOOTH_STAFF)
  payDraft(@CurrentUser() user: JwtPayload, @Param('id') id: string, @Body() dto: PayDraftSaleDto) {
    return this.salesService.payDraftSale(user, id, dto);
  }

  @Delete(':id/draft')
  @Roles(UserRole.BOOTH_STAFF)
  deleteDraft(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.salesService.deleteDraft(user, id);
  }

  /// Tab "Riwayat Penjualan" halaman Booth — lihat SalesService.riwayatBooth.
  /// Bulan & tahun default ke periode berjalan Asia/Jakarta, sama seperti
  /// StockMovementsController, supaya kedua tab di halaman Booth konsisten.
  @Get('riwayat-booth')
  @Roles(UserRole.ADMIN, UserRole.OWNER)
  riwayatBooth(
    @Query('boothId') boothId?: string,
    @Query('bulan') bulan?: string,
    @Query('tahun') tahun?: string,
  ) {
    const jakarta = new Date(Date.now() + 7 * 60 * 60 * 1000);
    return this.salesService.riwayatBooth({
      boothId: boothId || undefined,
      bulan: bulan ? Number(bulan) : jakarta.getUTCMonth() + 1,
      tahun: tahun ? Number(tahun) : jakarta.getUTCFullYear(),
    });
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.OWNER)
  findOne(@Param('id') id: string) {
    return this.salesService.findOne(id);
  }

  @Post(':id/preview-void')
  @Roles(UserRole.ADMIN)
  previewVoid(@Param('id') id: string) {
    return this.salesService.previewVoidSale(id);
  }

  @Post(':id/void')
  @Roles(UserRole.ADMIN)
  void(@CurrentUser() user: JwtPayload, @Param('id') id: string, @Body() dto: VoidSaleDto) {
    return this.salesService.voidSale(user, id, dto);
  }

  @Post(':id/preview-revise')
  @Roles(UserRole.ADMIN)
  previewRevise(@Param('id') id: string, @Body() dto: ReviseSaleDto) {
    return this.salesService.previewReviseSale(id, dto);
  }

  @Post(':id/revise')
  @Roles(UserRole.ADMIN)
  revise(@CurrentUser() user: JwtPayload, @Param('id') id: string, @Body() dto: ReviseSaleDto) {
    return this.salesService.reviseSale(user, id, dto);
  }

  @Post(':id/revise-payment')
  @Roles(UserRole.ADMIN)
  revisePayment(@CurrentUser() user: JwtPayload, @Param('id') id: string, @Body() dto: RevisePaymentDto) {
    return this.salesService.revisePayment(user, id, dto);
  }

  @Get(':id/refunds')
  @Roles(UserRole.ADMIN, UserRole.OWNER)
  listRefunds(@Param('id') id: string) {
    return this.salesService.listRefunds(id);
  }

  @Post(':id/refund')
  @Roles(UserRole.ADMIN)
  refund(@CurrentUser() user: JwtPayload, @Param('id') id: string, @Body() dto: CreateRefundDto) {
    return this.salesService.createRefund(user, id, dto);
  }
}
