import { Body, Controller, Get, Param, Post, Query, Req, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UserRole } from '@prisma/client';
import type { Request } from 'express';
import { imageFilePipe, imageUploadOptions, publicUploadUrl } from '../../common/image-upload';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { JwtPayload } from '../auth/jwt-payload.interface';
import { AttendanceDto } from './dto/attendance.dto';
import { CheckInDto } from './dto/check-in.dto';
import { LocationPingDto } from './dto/location-ping.dto';
import { ConfirmClosingDto } from './dto/confirm-closing.dto';
import { ConfirmCashDepositDto } from './dto/confirm-cash-deposit.dto';
import { CorrectShiftDto } from './dto/correct-shift.dto';
import { ShiftsService } from './shifts.service';

@Controller('shifts')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ShiftsController {
  constructor(private readonly shiftsService: ShiftsService) {}

  @Get('active')
  getActive(@CurrentUser() user: JwtPayload) {
    return this.shiftsService.getMyActiveShift(user);
  }

  /// Shift yang sudah Check-Out tapi belum absen Kembali di Gudang (null kalau tidak ada).
  @Get('pending-return')
  @Roles(UserRole.BOOTH_STAFF)
  getPendingReturn(@CurrentUser() user: JwtPayload) {
    return this.shiftsService.getMyPendingReturn(user);
  }

  @Get('active-assignments')
  @Roles(UserRole.ADMIN, UserRole.OWNER)
  getActiveAssignments() {
    return this.shiftsService.findActiveAssignments();
  }

  @Get('history')
  @Roles(UserRole.BOOTH_STAFF)
  getHistory(@CurrentUser() user: JwtPayload, @Query('month') month?: string) {
    return this.shiftsService.getMyHistory(user, month);
  }

  @Get('admin-history')
  @Roles(UserRole.ADMIN, UserRole.OWNER)
  getAdminHistory() {
    return this.shiftsService.getAdminHistory();
  }

  @Get(':id/report')
  @Roles(UserRole.BOOTH_STAFF, UserRole.ADMIN, UserRole.OWNER)
  getReport(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.shiftsService.getShiftReport(id, user);
  }

  @Post('check-in')
  @Roles(UserRole.BOOTH_STAFF)
  checkIn(@CurrentUser() user: JwtPayload, @Body() dto: CheckInDto) {
    return this.shiftsService.checkIn(user, dto);
  }

  @Post(':id/arrive')
  @Roles(UserRole.BOOTH_STAFF)
  arrive(@Param('id') id: string, @Body() dto: AttendanceDto, @CurrentUser() user: JwtPayload) {
    return this.shiftsService.arrive(user, id, dto);
  }

  @Post(':id/return')
  @Roles(UserRole.BOOTH_STAFF)
  returnToWarehouse(@Param('id') id: string, @Body() dto: AttendanceDto, @CurrentUser() user: JwtPayload) {
    return this.shiftsService.returnToWarehouse(user, id, dto);
  }

  @Post(':id/location-ping')
  @Roles(UserRole.BOOTH_STAFF)
  recordLocationPing(
    @Param('id') id: string,
    @Body() dto: LocationPingDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.shiftsService.recordLocationPing(user, id, dto);
  }

  @Get(':id/journey')
  @Roles(UserRole.ADMIN, UserRole.OWNER)
  getJourney(@Param('id') id: string) {
    return this.shiftsService.getShiftJourney(id);
  }

  @Post('attendance/photo')
  @Roles(UserRole.BOOTH_STAFF)
  @UseInterceptors(FileInterceptor('file', imageUploadOptions('attendance', 'Foto selfie')))
  uploadAttendancePhoto(@UploadedFile(imageFilePipe()) file: Express.Multer.File, @Req() request: Request) {
    return { photoUrl: publicUploadUrl(request, 'attendance', file.filename) };
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

  @Post(':id/cash-deposit/confirm')
  @Roles(UserRole.ADMIN, UserRole.OWNER)
  confirmCashDeposit(@Param('id') id: string, @Body() dto: ConfirmCashDepositDto, @CurrentUser() user: JwtPayload) {
    return this.shiftsService.confirmCashDeposit(id, dto, user);
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
