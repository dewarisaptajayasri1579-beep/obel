import { BadRequestException, Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { JwtPayload } from '../auth/jwt-payload.interface';
import { CreateReturnDto } from './dto/create-return.dto';
import { ReceiveReturnDto } from './dto/receive-return.dto';
import { ReturnsService } from './returns.service';

@Controller('returns')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReturnsController {
  constructor(private readonly returnsService: ReturnsService) {}

  @Get()
  @Roles(UserRole.ADMIN, UserRole.OWNER)
  findAll() {
    return this.returnsService.findAll();
  }

  @Get('mine')
  @Roles(UserRole.BOOTH_STAFF)
  findMine(@CurrentUser() user: JwtPayload) {
    if (!user.boothId) {
      throw new BadRequestException('User belum memiliki assignment booth.');
    }
    return this.returnsService.findForBooth(user.boothId);
  }

  @Post()
  @Roles(UserRole.BOOTH_STAFF)
  create(@Body() dto: CreateReturnDto, @CurrentUser() user: JwtPayload) {
    if (!user.boothId) {
      throw new BadRequestException('User belum memiliki assignment booth.');
    }
    return this.returnsService.create(dto, user.boothId, user.sub);
  }

  @Post(':id/receive')
  @Roles(UserRole.ADMIN)
  receive(@Param('id') id: string, @Body() dto: ReceiveReturnDto, @CurrentUser() user: JwtPayload) {
    return this.returnsService.receive(id, dto, user.sub);
  }
}
