import { Module } from '@nestjs/common';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { ProductReportService } from './product-report.service';
import { StockReceiptReportService } from './stock-receipt-report.service';
import { StockHandoverReportService } from './stock-handover-report.service';
import { StockDiscrepancyReportService } from './stock-discrepancy-report.service';
import { SalesReportService } from './sales-report.service';
import { StockReturnRecapReportService } from './stock-return-recap-report.service';
import { CompanyProfileModule } from '../company-profile/company-profile.module';
import { StockHandoversModule } from '../stock-handovers/stock-handovers.module';
import { CorrectionsModule } from '../corrections/corrections.module';

@Module({
  imports: [CompanyProfileModule, StockHandoversModule, CorrectionsModule],
  controllers: [ReportsController],
  providers: [
    ReportsService,
    ProductReportService,
    StockReceiptReportService,
    StockHandoverReportService,
    StockDiscrepancyReportService,
    SalesReportService,
    StockReturnRecapReportService,
  ],
})
export class ReportsModule {}
