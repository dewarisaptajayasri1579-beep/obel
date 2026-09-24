import {
  BadRequestException,
  Body,
  Controller,
  FileTypeValidator,
  Get,
  MaxFileSizeValidator,
  Param,
  ParseFilePipe,
  Post,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UserRole } from '@prisma/client';
import { randomUUID } from 'crypto';
import { mkdirSync } from 'fs';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import type { Request } from 'express';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { JwtPayload } from '../auth/jwt-payload.interface';
import { CheckInDto } from './dto/check-in.dto';
import { LocationPingDto } from './dto/location-ping.dto';
import { ConfirmClosingDto } from './dto/confirm-closing.dto';
import { ConfirmCashDepositDto } from './dto/confirm-cash-deposit.dto';
import { CorrectShiftDto } from './dto/correct-shift.dto';
import { ShiftsService } from './shifts.service';

const attendanceUploadDir = join(process.cwd(), 'uploads', 'attendance');
mkdirSync(attendanceUploadDir, { recursive: true });

@Controller('shifts')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ShiftsController {
  constructor(private readonly shiftsService: ShiftsService) {}

  @Get('active')
  getActive(@CurrentUser() user: JwtPayload) {
    return this.shiftsService.getMyActiveShift(user);
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
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: attendanceUploadDir,
        filename: (_request, file, callback) => {
          callback(null, `${randomUUID()}${extname(file.originalname).toLowerCase()}`);
        },
      }),
      limits: { fileSize: 5 * 1024 * 1024 },
      fileFilter: (_request, file, callback) => {
        if (!/^image\/(jpeg|png|webp|gif)$/.test(file.mimetype)) {
          callback(new BadRequestException('Foto selfie harus berupa JPG, PNG, WEBP, atau GIF.'), false);
          return;
        }
        callback(null, true);
      },
    }),
  )
  uploadAttendancePhoto(
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 5 * 1024 * 1024 }),
          new FileTypeValidator({
            fileType: /^image\/(jpeg|png|webp|gif)$/,
            skipMagicNumbersValidation: true,
          }),
        ],
      }),
    )
    file: Express.Multer.File,
    @Req() request: Request,
  ) {
    const publicBaseUrl = (process.env.PUBLIC_API_URL ?? `${request.protocol}://${request.get('host')}`).replace(/\/$/, '');
    return { photoUrl: `${publicBaseUrl}/uploads/attendance/${file.filename}` };
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
