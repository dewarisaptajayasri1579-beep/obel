import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { ActivityLogService } from '../common/activity-log.service';
import { AccessService } from '../common/access/access.service';

@Global()
@Module({
  providers: [PrismaService, ActivityLogService, AccessService],
  exports: [PrismaService, ActivityLogService, AccessService],
})
export class PrismaModule {}
