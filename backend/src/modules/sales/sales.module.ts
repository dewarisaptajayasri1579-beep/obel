import { Module } from '@nestjs/common';
import { CorrectionsModule } from '../corrections/corrections.module';
import { SalesController } from './sales.controller';
import { SalesService } from './sales.service';

@Module({
  imports: [CorrectionsModule],
  controllers: [SalesController],
  providers: [SalesService],
})
export class SalesModule {}
