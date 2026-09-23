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
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UserRole } from '@prisma/client';
import { extname } from 'path';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { JwtPayload } from '../auth/jwt-payload.interface';
import { StorageService } from '../../common/storage/storage.service';
import { CheckInDto } from './dto/check-in.dto';
import { ConfirmClosingDto } from './dto/confirm-closing.dto';
import { CorrectShiftDto } from './dto/correct-shift.dto';
import { ShiftsService } from './shifts.service';

@Controller('shifts')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ShiftsController {
  constructor(
    private readonly shiftsService: ShiftsService,
    private readonly storage: StorageService,
  ) {}

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

  @Get(':id/report')
  @Roles(UserRole.BOOTH_STAFF)
  getReport(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.shiftsService.getShiftReport(id, user);
  }

  @Post('check-in')
  @Roles(UserRole.BOOTH_STAFF)
  checkIn(@CurrentUser() user: JwtPayload, @Body() dto: CheckInDto) {
    return this.shiftsService.checkIn(user, dto);
  }

  @Post('attendance/photo')
  @Roles(UserRole.BOOTH_STAFF)
  @UseInterceptors(
    FileInterceptor('file', {
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
  async uploadAttendancePhoto(
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
  ) {
    const { url } = await this.storage.upload('attendance', file.buffer, file.mimetype, extname(file.originalname).toLowerCase());
    return { photoUrl: url };
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
