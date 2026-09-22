import { Controller, Get, HttpCode, HttpStatus, Param, Post, Query } from "@nestjs/common"
import { StockProdukService } from "./stock-produk.service.js"
import { Roles } from "../auth/decorators/roles.decorator.js"

/** Rekap stok per produk (Tahap 18) — dipakai kolom Stok di Master Produk dan halaman
 *  `master/produk/[id]/stok` beserta drill-down mutasinya.
 *
 *  Dipisah dari `stock-gudang`/`stock-sales`/`stock-toko` yang sudah ada: ketiganya menjawab
 *  "apa saja yang ada di lokasi X", sedangkan yang ini menjawab "produk X ada di mana saja" —
 *  sumbu bacanya berbeda walau tabel sumbernya sama (`StockLedger`). */
@Roles("owner", "admin")
@Controller("stock/produk")
export class StockProdukController {
  constructor(private readonly stockProdukService: StockProdukService) {}

  @Get("ringkas")
  ringkas(@Query("from") from?: string, @Query("to") to?: string) {
    return this.stockProdukService.ringkas({ from, to })
  }

  /** Bandingkan cache saldo dengan ledger. Ini yang membuat `stock_balances` boleh disebut
   *  cache: kalau ada selisih, ketahuan di sini — bukan ditemukan berbulan-bulan kemudian lewat
   *  stok fisik yang tidak cocok. */
  @Get("rekonsiliasi")
  rekonsiliasi() {
    return this.stockProdukService.rekonsiliasi()
  }

  /** Bangun ulang seluruh cache saldo dari ledger. Owner saja — bukan karena berbahaya (hasilnya
   *  deterministik dari ledger), tapi karena ini tombol pemulihan, bukan operasi harian. */
  @Roles("owner")
  @HttpCode(HttpStatus.OK)
  @Post("rekonsiliasi")
  bangunUlang() {
    return this.stockProdukService.bangunUlangSaldo()
  }

  // Rute literal WAJIB sebelum ":productId" — kalau dibalik, "mutasi-bulanan" dianggap id produk.
  @Get("mutasi-bulanan")
  mutasiBulanan(
    @Query("productId") productId?: string,
    @Query("businessTypeId") businessTypeId?: string,
    @Query("from") from?: string,
    @Query("to") to?: string,
  ) {
    return this.stockProdukService.mutasiBulanan({ productId, businessTypeId, from, to })
  }

  @Get(":productId/rekap")
  rekap(@Param("productId") productId: string, @Query("from") from?: string, @Query("to") to?: string) {
    return this.stockProdukService.rekap(productId, { from, to })
  }

  @Get(":productId/mutasi")
  mutasi(
    @Param("productId") productId: string,
    @Query("locationType") locationType: string,
    @Query("locationId") locationId: string,
    @Query("from") from?: string,
    @Query("to") to?: string
  ) {
    return this.stockProdukService.mutasi(productId, { locationType, locationId, from, to })
  }
}
