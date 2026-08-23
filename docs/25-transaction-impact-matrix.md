# 25 — Transaction Impact Matrix

Dokumen ini adalah quick reference untuk AI Coding Agent. Detail normatif tetap berada di `24-data-consistency-correction-reversal.md`.

| Transaksi | Efek saat posted | Boleh edit sebelum posted | Cara batal setelah posted | Cara revisi setelah posted | Dampak otomatis yang wajib direcalculate |
|---|---|---|---|---|---|
| Distribusi Gudang → Booth | Gudang/transit berkurang/bertambah sesuai model | Ya, saat DRAFT | Reversal shipment | Reverse V1 + post V2 | Warehouse, transit, Booth, expected closing, stock report |
| Receive Distribusi | Booth stock bertambah | Qty boleh dikoreksi sebelum confirm | Receive correction/reversal sesuai state | Versioned receive correction | Booth stock, distribution discrepancy, closing, reconciliation |
| Sale PAID | Booth stock turun, omzet/cup/payment naik | Cart/PENDING bebas edit | VOID + stock/payment reversal | Reverse sale V1 + replacement V2 | Stock, omzet, cup sold, payment, ranking, shift, discrepancy, return |
| Payment | Cash/QRIS ledger naik | Sebelum paid | Bersama sale void atau payment reversal | Payment correction | Cash/QRIS summary; omzet hanya berubah jika sale amount berubah |
| Restock Request | Tidak ada stock effect sebelum shipment | Ya selama REQUESTED | Cancel request | Revision requested/approved qty | Queue/status; tidak boleh menghapus shipment yang sudah terjadi |
| Restock Shipment | Gudang/transit/Booth sesuai state | Sebelum SENT | Reversal shipment | Reverse + replacement | Warehouse, Booth, low stock, closing, report |
| Shift Open | Membuka scope transaksi | Sebelum ada dependent transaction | Cancel jika belum dipakai | Shift correction Admin-only | Assignment/summary/dependency validation |
| Closing / Physical Count | Membuat discrepancy/adjustment, menutup shift | Ya saat DRAFT | Tidak delete; correction flow | Recount V2 + compensating adjustment | Expected, actual, discrepancy, Booth stock, return, shift summary |
| Return Submit Booth → Gudang | Stock unavailable/in-transit sesuai model | Ya saat DRAFT | Cancel sebelum received | Versioned return correction | Booth/transit/expected receiving |
| Return Receipt Gudang | Warehouse stock bertambah actual received | Sebelum confirm | Correction/reversal, bukan delete | Return receipt correction delta | Warehouse, return discrepancy, reconciliation |
| Stock Opname Booth | Adjustment ke actual physical | Ya saat DRAFT | Reverse adjustment jika opname dibatalkan secara sah | Recount version | Booth stock, discrepancy, audit |
| Stock Opname Gudang | Adjustment Gudang ke actual physical | Ya saat DRAFT | Reverse adjustment | Recount version | Warehouse stock, discrepancy |
| Manual Stock Adjustment | Stock location +/- | Sebelum post | Reverse adjustment | Reverse old + post new | Inventory only, kecuali bagian sale correction |
| Customer Sales Return/Refund | Net sales/payment turun; stock optional | Draft boleh edit | Reverse refund jika salah | Refund revision | Net omzet, payment, ranking; stock hanya jika return-to-stock |
| Master Price | Mempengaruhi sale baru | Ya | N/A; deactivate/schedule | New effective price | Tidak merestate sale histori |

---

# Rules yang berlaku untuk semua baris

1. Posted transaction tidak hard-delete.
2. Posted transaction tidak direct-edit untuk field material.
3. Semua cancel/revision harus reason + actor + timestamp.
4. Semua mutation kritis idempotent.
5. Stock movement append-only.
6. No negative stock.
7. Correction historis boleh merestate report tetapi tidak menghapus physical evidence lama.
8. Bila chain tidak bisa direconcile otomatis, create `RECONCILIATION_REQUIRED`.
9. Dashboard Admin/Owner harus membaca effective/net data terbaru.
10. `warehouse_stocks` dan `booth_stocks` harus dapat diverifikasi/rebuild dari ledger.

---

# Tiga contoh paling kritis

## 1. Sale salah qty setelah shift CLOSED

```text
Sale V1: Matcha 2
→ closing actual sudah dilakukan
→ return sudah diterima Gudang
→ Admin revisi menjadi Matcha 1
```

Sistem wajib:
- reverse V1;
- post V2;
- omzet -10.000 dibanding V1;
- cup sold -1 dibanding V1;
- recalculate expected closing;
- physical count tidak diubah;
- recalculate discrepancy;
- recalculate return reconciliation;
- pastikan current stock tetap valid;
- bila chain tidak valid → reconciliation case.

## 2. Penerimaan stok salah

```text
Dikirim 10
Recorded receive 10
Fisik ternyata 9
```

Sistem tidak mengedit row receive menjadi 9. Buat correction version/delta:
- Booth -1;
- discrepancy -1;
- audit V1/V2;
- closing/report update.

## 3. Stok opname salah input

```text
Expected 10
Count V1 = 8 → adjustment -2
Ternyata actual yang benar = 9
```

Recount V2:
- correction +1;
- final effective stock = 9;
- V1 tetap ada;
- final discrepancy = -1.
