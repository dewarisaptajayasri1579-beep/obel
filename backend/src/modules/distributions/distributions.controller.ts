import { BadRequestException, Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { JwtPayload } from '../auth/jwt-payload.interface';
import { CreateDistributionDto } from './dto/create-distribution.dto';
import { ReceiveDistributionDto } from './dto/receive-distribution.dto';
import { CancelDistributionDto, CorrectReceiptDto, ReviseDistributionDto } from './dto/correction.dto';
import { DistributionsService } from './distributions.service';

@Controller('distributions')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DistributionsController {
  constructor(private readonly distributionsService: DistributionsService) {}

  @Get()
  @Roles(UserRole.ADMIN, UserRole.OWNER)
  findAll() {
    return this.distributionsService.findAll();
  }

  @Get('pending')
  @Roles(UserRole.BOOTH_STAFF)
  findPending(@CurrentUser() user: JwtPayload) {
    if (!user.boothId) {
      throw new BadRequestException('User belum memiliki assignment booth.');
    }
    return this.distributionsService.findPendingForBooth(user.boothId);
  }

  @Post()
  @Roles(UserRole.ADMIN)
  create(@Body() dto: CreateDistributionDto, @CurrentUser() user: JwtPayload) {
    return this.distributionsService.create(dto, user.sub);
  }

  @Post(':id/receive')
  @Roles(UserRole.BOOTH_STAFF, UserRole.ADMIN)
  receive(
    @Param('id') id: string,
    @Body() dto: ReceiveDistributionDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.distributionsService.receive(id, dto, user);
  }

  @Post(':id/cancel')
  @Roles(UserRole.ADMIN)
  cancel(@Param('id') id: string, @Body() dto: CancelDistributionDto, @CurrentUser() user: JwtPayload) {
    return this.distributionsService.cancelDistribution(user, id, dto);
  }

  @Post(':id/revise')
  @Roles(UserRole.ADMIN)
  revise(@Param('id') id: string, @Body() dto: ReviseDistributionDto, @CurrentUser() user: JwtPayload) {
    return this.distributionsService.reviseDistribution(user, id, dto);
  }

  @Post(':id/correct-receipt')
  @Roles(UserRole.ADMIN)
  correctReceipt(@Param('id') id: string, @Body() dto: CorrectReceiptDto, @CurrentUser() user: JwtPayload) {
    return this.distributionsService.correctReceipt(user, id, dto);
  }
}
