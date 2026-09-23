import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CorrectionsModule } from '../corrections/corrections.module';
import { ReturnsModule } from '../returns/returns.module';
import { ShiftsController } from './shifts.controller';
import { ShiftsService } from './shifts.service';

@Module({
  imports: [CorrectionsModule, AuthModule, ReturnsModule],
  controllers: [ShiftsController],
  providers: [ShiftsService],
  exports: [ShiftsService],
})
export class ShiftsModule {}
