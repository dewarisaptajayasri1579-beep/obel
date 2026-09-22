import { Module } from '@nestjs/common';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { ProductReportService } from './product-report.service';

@Module({
  controllers: [ReportsController],
  providers: [ReportsService, ProductReportService],
})
export class ReportsModule {}
