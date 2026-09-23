import { Module } from '@nestjs/common';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { ProductReportService } from './product-report.service';
import { StockReceiptReportService } from './stock-receipt-report.service';
import { StockHandoverReportService } from './stock-handover-report.service';
import { SalesReportService } from './sales-report.service';
import { CompanyProfileModule } from '../company-profile/company-profile.module';
import { StockHandoversModule } from '../stock-handovers/stock-handovers.module';

@Module({
  imports: [CompanyProfileModule, StockHandoversModule],
  controllers: [ReportsController],
  providers: [ReportsService, ProductReportService, StockReceiptReportService, StockHandoverReportService, SalesReportService],
})
export class ReportsModule {}
