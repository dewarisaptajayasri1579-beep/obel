import { Module } from '@nestjs/common';
import { AttendancePermitsController } from './attendance-permits.controller';
import { AttendancePermitsService } from './attendance-permits.service';

@Module({
  controllers: [AttendancePermitsController],
  providers: [AttendancePermitsService],
  exports: [AttendancePermitsService],
})
export class AttendancePermitsModule {}
