import { Module } from '@nestjs/common';
import { CorrectionsModule } from '../corrections/corrections.module';
import { StockOpnameController } from './stock-opname.controller';
import { StockOpnameService } from './stock-opname.service';

@Module({
  imports: [CorrectionsModule],
  controllers: [StockOpnameController],
  providers: [StockOpnameService],
})
export class StockOpnameModule {}
