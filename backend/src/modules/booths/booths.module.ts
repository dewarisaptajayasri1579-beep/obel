import { Module } from '@nestjs/common';
import { BoothsController } from './booths.controller';
import { BoothsService } from './booths.service';

@Module({
  controllers: [BoothsController],
  providers: [BoothsService],
})
export class BoothsModule {}
