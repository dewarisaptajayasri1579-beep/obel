import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { JwtPayload } from '../auth/jwt-payload.interface';
import { ConfirmOpnameDto, RecountOpnameDto, StartOpnameDto } from './dto/opname.dto';
import { StockOpnameService } from './stock-opname.service';

@Controller('stock-opname')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.OWNER)
export class StockOpnameController {
  constructor(private readonly stockOpnameService: StockOpnameService) {}

  @Get()
  findAll() {
    return this.stockOpnameService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.stockOpnameService.findOne(id);
  }

  @Post()
  @Roles(UserRole.ADMIN)
  start(@Body() dto: StartOpnameDto, @CurrentUser() user: JwtPayload) {
    return this.stockOpnameService.start(dto, user);
  }

  @Post(':id/confirm')
  @Roles(UserRole.ADMIN)
  confirm(@Param('id') id: string, @Body() dto: ConfirmOpnameDto, @CurrentUser() user: JwtPayload) {
    return this.stockOpnameService.confirm(id, dto, user);
  }

  @Post(':id/recount')
  @Roles(UserRole.ADMIN)
  recount(@Param('id') id: string, @Body() dto: RecountOpnameDto, @CurrentUser() user: JwtPayload) {
    return this.stockOpnameService.recount(id, dto, user);
  }
}
