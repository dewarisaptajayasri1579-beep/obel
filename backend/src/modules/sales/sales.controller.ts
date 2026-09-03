import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { JwtPayload } from '../auth/jwt-payload.interface';
import { CreateSaleDto } from './dto/create-sale.dto';
import { ReviseSaleDto, RevisePaymentDto } from './dto/revise-sale.dto';
import { VoidSaleDto } from './dto/void-sale.dto';
import { CreateRefundDto } from './dto/create-refund.dto';
import { SalesService } from './sales.service';

@Controller('sales')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SalesController {
  constructor(private readonly salesService: SalesService) {}

  @Get()
  @Roles(UserRole.ADMIN, UserRole.OWNER)
  findAll() {
    return this.salesService.findAll();
  }

  @Post()
  @Roles(UserRole.BOOTH_STAFF, UserRole.ADMIN)
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateSaleDto) {
    return this.salesService.createPaidSale(user, dto);
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
