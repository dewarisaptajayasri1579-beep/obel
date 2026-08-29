import { Module } from '@nestjs/common';
import { CorrectionsModule } from '../corrections/corrections.module';
import { ReturnsController } from './returns.controller';
import { ReturnsService } from './returns.service';

@Module({
  imports: [CorrectionsModule],
  controllers: [ReturnsController],
  providers: [ReturnsService],
})
export class ReturnsModule {}
