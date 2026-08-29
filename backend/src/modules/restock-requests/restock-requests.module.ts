import { Module } from '@nestjs/common';
import { DistributionsModule } from '../distributions/distributions.module';
import { RestockRequestsController } from './restock-requests.controller';
import { RestockRequestsService } from './restock-requests.service';

@Module({
  imports: [DistributionsModule],
  controllers: [RestockRequestsController],
  providers: [RestockRequestsService],
})
export class RestockRequestsModule {}
