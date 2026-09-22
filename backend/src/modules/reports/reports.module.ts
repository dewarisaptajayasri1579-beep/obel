import { Module } from '@nestjs/common';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { ProductReportService } from './product-report.service';
import { StockReceiptReportService } from './stock-receipt-report.service';
import { CompanyProfileModule } from '../company-profile/company-profile.module';

@Module({
  imports: [CompanyProfileModule],
  controllers: [ReportsController],
  providers: [ReportsService, ProductReportService, StockReceiptReportService],
})
export class ReportsModule {}
