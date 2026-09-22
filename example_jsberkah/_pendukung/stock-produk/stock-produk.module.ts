import { Module } from "@nestjs/common"
import { StockProdukController } from "./stock-produk.controller.js"
import { StockProdukService } from "./stock-produk.service.js"

@Module({
  controllers: [StockProdukController],
  providers: [StockProdukService],
})
export class StockProdukModule {}
