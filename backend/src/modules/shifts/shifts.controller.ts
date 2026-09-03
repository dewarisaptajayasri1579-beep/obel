import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { JwtPayload } from '../auth/jwt-payload.interface';
import { ConfirmClosingDto } from './dto/confirm-closing.dto';
import { CorrectShiftDto } from './dto/correct-shift.dto';
import { ShiftsService } from './shifts.service';

@Controller('shifts')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ShiftsController {
  constructor(private readonly shiftsService: ShiftsService) {}

  @Get('active')
  getActive(@CurrentUser() user: JwtPayload) {
    return this.shiftsService.getMyActiveShift(user.sub);
  }

  @Post(':id/closing/start')
  startClosing(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.shiftsService.startClosing(id, user);
  }

  @Post(':id/closing/confirm')
  confirmClosing(
    @Param('id') id: string,
    @Body() dto: ConfirmClosingDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.shiftsService.confirmClosing(id, dto, user);
  }

  @Get(':id/preview-correction')
  @Roles(UserRole.ADMIN)
  previewCorrection(@Param('id') id: string) {
    return this.shiftsService.previewShiftCorrection(id);
  }

  @Post(':id/correct')
  @Roles(UserRole.ADMIN)
  correct(@Param('id') id: string, @Body() dto: CorrectShiftDto, @CurrentUser() user: JwtPayload) {
    return this.shiftsService.correctShift(id, dto, user);
  }
}
