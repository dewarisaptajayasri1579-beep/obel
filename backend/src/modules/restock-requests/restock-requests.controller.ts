import { BadRequestException, Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { JwtPayload } from '../auth/jwt-payload.interface';
import { ApproveRestockRequestDto } from './dto/approve-restock-request.dto';
import { CreateRestockRequestDto } from './dto/create-restock-request.dto';
import { RejectRestockRequestDto } from './dto/reject-restock-request.dto';
import { RestockRequestsService } from './restock-requests.service';

@Controller('restock-requests')
@UseGuards(JwtAuthGuard, RolesGuard)
export class RestockRequestsController {
  constructor(private readonly restockRequestsService: RestockRequestsService) {}

  @Get()
  @Roles(UserRole.ADMIN, UserRole.OWNER)
  findAll() {
    return this.restockRequestsService.findAll();
  }

  @Get('mine')
  @Roles(UserRole.BOOTH_STAFF)
  findMine(@CurrentUser() user: JwtPayload) {
    if (!user.boothId) {
      throw new BadRequestException('User belum memiliki assignment booth.');
    }
    return this.restockRequestsService.findForBooth(user.boothId);
  }

  @Post()
  @Roles(UserRole.BOOTH_STAFF)
  create(@Body() dto: CreateRestockRequestDto, @CurrentUser() user: JwtPayload) {
    if (!user.boothId) {
      throw new BadRequestException('User belum memiliki assignment booth.');
    }
    return this.restockRequestsService.create(dto, user.boothId, user.sub);
  }

  @Post(':id/revise')
  @Roles(UserRole.BOOTH_STAFF, UserRole.ADMIN)
  revise(@Param('id') id: string, @Body() dto: CreateRestockRequestDto) {
    return this.restockRequestsService.reviseRequestedItems(id, dto);
  }

  @Post(':id/approve')
  @Roles(UserRole.ADMIN)
  approve(@Param('id') id: string, @Body() dto: ApproveRestockRequestDto, @CurrentUser() user: JwtPayload) {
    return this.restockRequestsService.approve(id, dto, user.sub);
  }

  @Post(':id/reject')
  @Roles(UserRole.ADMIN)
  reject(@Param('id') id: string, @Body() dto: RejectRestockRequestDto, @CurrentUser() user: JwtPayload) {
    return this.restockRequestsService.reject(id, dto, user.sub);
  }
}
