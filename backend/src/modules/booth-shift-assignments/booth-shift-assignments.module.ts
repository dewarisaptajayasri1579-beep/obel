import { Module } from '@nestjs/common';
import { BoothShiftAssignmentsController } from './booth-shift-assignments.controller';
import { BoothShiftAssignmentsService } from './booth-shift-assignments.service';

@Module({
  controllers: [BoothShiftAssignmentsController],
  providers: [BoothShiftAssignmentsService],
})
export class BoothShiftAssignmentsModule {}
