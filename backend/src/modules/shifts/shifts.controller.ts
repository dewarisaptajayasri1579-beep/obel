import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { JwtPayload } from '../auth/jwt-payload.interface';
import { ConfirmClosingDto } from './dto/confirm-closing.dto';
import { ShiftsService } from './shifts.service';

@Controller('shifts')
@UseGuards(JwtAuthGuard)
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
}
