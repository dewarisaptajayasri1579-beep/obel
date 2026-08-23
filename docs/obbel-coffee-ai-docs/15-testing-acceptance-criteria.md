# 15 — Testing & Acceptance Criteria

## AC-01 Login Booth Staff
**Given** user BOOTH_STAFF aktif dan memiliki assignment  
**When** login benar  
**Then** masuk ke Beranda Booth yang benar.

## AC-02 Unauthorized Booth
Booth Staff tidak dapat query/mutation Booth lain walau mengganti ID melalui request manual.

## AC-03 Receive distribution
Given Warehouse sent Matcha 10 ke Booth A.  
When Booth A receives 10.  
Then Booth stock +10, distribution RECEIVED, movement tercatat sekali.

## AC-04 Double receive
Tap receive dua kali dengan idempotency key yang sama tidak menambah stok dua kali.

## AC-05 Sale success
Given Booth stock Matcha 5.  
When sale qty 2 paid.  
Then stock menjadi 3, sale PAID, payment tercatat, movement qty 2.

## AC-06 Sale insufficient stock
Given stock 1.  
When sale qty 2.  
Then transaction gagal seluruhnya, stock tetap 1, tidak ada paid sale/movement.

## AC-07 Concurrent sales
Dua device mencoba membeli stok terakhir secara bersamaan. Hanya transaksi yang mendapat stock lock/availability yang boleh sukses; tidak boleh stock negatif.

## AC-08 Price authority
Client mencoba mengirim harga 1 Rupiah untuk product harga 10.000. Server tetap memakai harga master 10.000.

## AC-09 Low stock alert
Jika qty turun <= minimum, status Menipis. Jika <= critical, Kritis. Jika 0, Habis.

## AC-10 Restock request
Booth Staff dapat request. Admin melihat request realtime/pada refresh. Owner hanya melihat dampak stock, bukan action.

## AC-11 Approve restock over stock
Admin tidak boleh mengirim restock lebih besar dari warehouse available.

## AC-12 Receive restock
Saat receive, Booth stock bertambah tepat satu kali dan movement tersedia.

## AC-13 Closing discrepancy
Expected 5, actual 4 → discrepancy -1 dan reason wajib.

## AC-14 Closing no reason
Jika discrepancy != 0 dan reason kosong, backend menolak confirm.

## AC-15 Closed shift sale
Setelah CLOSED, sale baru pada shift ditolak.

## AC-16 Return
Submitted 10 dan Admin received 10 → warehouse +10, return RECEIVED.

## AC-17 Return discrepancy
Submitted 10, received 9 → status/discrepancy tercatat dan warehouse hanya +9.

## AC-18 Owner mutation
Owner mutation API/RPC ditolak server.

## AC-19 Sales report
Omzet hanya menghitung PAID dan tidak menghitung VOIDED.

## AC-20 Void sale
Void menghasilkan stock reversal dan audit; sale tidak dihapus.

## AC-21 Printer failure
Sale sukses tetapi printer gagal → sale tetap PAID dan tersedia Print Ulang.

## AC-22 PWA responsive
Admin dapat menggunakan fungsi inti di desktop dan tablet. Pada mobile, tabel kompleks memiliki fallback card/scroll yang usable.

## AC-23 Loading/error
Semua mutation mempunyai loading disabled state dan error message yang dapat dipahami.

## AC-24 Timezone
Transaksi mendekati tengah malam dikelompokkan ke business date Asia/Jakarta dengan benar.

## AC-25 Master inactive
Product inactive tidak tampil untuk sale baru, tetapi histori sale lama tetap menampilkan snapshot nama/harga.

## Test scenarios end-to-end

### E2E-1 Hari normal
1. Admin buat shift.
2. Admin kirim 10 Original + 10 Matcha.
3. Petugas receive.
4. Jual Original 9.
5. Stock Original = 1 dan alert aktif.
6. Petugas request +10.
7. Admin send +10.
8. Petugas receive → Original 11.
9. Jual 5 → sisa 6.
10. Closing actual 6.
11. Return 6.
12. Admin receive.
13. Owner dashboard reflect omzet/ranking.

### E2E-2 Selisih
1. Expected Matcha 4.
2. Actual 3.
3. Petugas pilih Produk Tumpah.
4. Closing record discrepancy -1.
5. Booth balance adjusted ke 3 sesuai rule.
6. Return 3.
7. Owner sees -1 discrepancy.

## Correction & Consistency Acceptance Criteria

### AC-26 Void paid sale
Sale 2 Matcha @10.000 di-void → Booth stock +2, omzet -20.000, cup sold -2, payment reversed, original sale tetap ada.

### AC-27 Revise sale qty
Sale qty 2 → 1 → effective stock hanya -1 dan effective omzet 10.000; report tidak double count V1+V2.

### AC-28 Revise payment method
Cash → QRIS → stock dan omzet unchanged, Cash -amount, QRIS +amount.

### AC-29 Cancel sent distribution
Sent 10 belum received → cancel mengembalikan transit ke Gudang tepat sekali.

### AC-30 Correct distribution receipt
Recorded receive 10, actual 9 → Booth correction -1, discrepancy -1, original receipt immutable.

### AC-31 Post-close sale correction
Sale corrected setelah CLOSED → shift summary/expected/discrepancy direcalculate, actual count lama tidak berubah.

### AC-32 Recount
Expected 10, count V1 8, recount V2 9 → net inventory adjustment -1 terhadap expected.

### AC-33 Return receipt correction
Warehouse recorded 10, actual 9 → warehouse -1 via correction movement; original receive row tidak diedit.

### AC-34 Reverse adjustment
Adjustment -3 dibatalkan → compensating +3; net 0; kedua movement tersimpan.

### AC-35 No negative from correction
Correction yang akan membuat balance negatif tidak commit dan menghasilkan actionable reconciliation error/case.

### AC-36 Correction idempotency
Double submit dengan idempotency key sama menghasilkan satu correction.

### AC-37 No delete posted
Application role gagal melakukan DELETE posted sale/distribution/return/movement.

### AC-38 Projection rebuild
Setelah rangkaian normal + correction, rebuild ledger sama dengan warehouse/booth snapshot.

### AC-39 Dashboard restatement
Owner/Admin melihat KPI terbaru segera setelah correction/reconciliation selesai.

### AC-40 Stock opname revision
Confirmed opname tidak bisa update langsung; recount version menghasilkan audit lineage dan delta yang benar.
