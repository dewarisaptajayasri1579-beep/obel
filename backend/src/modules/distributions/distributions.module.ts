import { Module } from '@nestjs/common';
import { CorrectionsModule } from '../corrections/corrections.module';
import { DistributionsController } from './distributions.controller';
import { DistributionsService } from './distributions.service';

@Module({
  imports: [CorrectionsModule],
  controllers: [DistributionsController],
  providers: [DistributionsService],
  exports: [DistributionsService],
})
export class DistributionsModule {}
