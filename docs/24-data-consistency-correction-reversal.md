# 24 — Data Consistency, Revision, Cancellation, Stock Opname & Reconciliation

Dokumen ini adalah **aturan wajib** untuk seluruh transaksi Obbel Coffee & Milk. Tujuannya memastikan koreksi data tidak membuat stok, omzet, penjualan, pembayaran, shift, return, dan laporan saling berbeda.

> **Prinsip utama:** transaksi yang sudah `POSTED/PAID/SENT/RECEIVED/CONFIRMED` tidak boleh diedit atau dihapus langsung. Pembatalan dan revisi dilakukan dengan **reversal + replacement/correction transaction** yang tercatat permanen.

Dokumen ini harus dibaca bersama `07-database-schema.md`, `08-business-rules.md`, `09-api-rpc-contract.md`, `10-state-machines.md`, `12-reporting-dashboard.md`, dan `15-testing-acceptance-criteria.md`.

---

# 1. Sasaran konsistensi

Sistem harus selalu bisa menjawab dan merekonstruksi:

1. stok Gudang saat ini;
2. stok setiap Booth saat ini;
3. stok dalam perjalanan;
4. stok berdasarkan histori transaksi;
5. omzet bersih per hari/Booth/shift;
6. jumlah cup terjual bersih;
7. pembayaran Tunai/QRIS;
8. hasil stok opname fisik;
9. selisih stok sistem vs fisik;
10. transaksi apa yang pernah dibatalkan/direvisi;
11. siapa yang mengoreksi, kapan, dan alasannya;
12. dampak koreksi terhadap laporan lama dan saldo sekarang.

Tidak boleh ada kasus di mana UI terlihat benar tetapi ledger atau laporan berbeda.

---

# 2. Prinsip arsitektur yang tidak boleh dilanggar

## DC-001 — No hard delete untuk transaksi

Setelah transaksi pernah diposting, record transaksi tidak boleh dihapus.

Yang diperbolehkan:
- `VOID/REVERSED` untuk membatalkan;
- membuat versi baru untuk revisi;
- adjustment/correction untuk memperbaiki saldo;
- audit log permanen.

Hard delete hanya boleh untuk draft yang belum pernah mempunyai efek stok/uang dan belum direferensikan transaksi lain.

## DC-002 — Draft boleh diedit, Posted immutable

Transaksi dibagi dua fase:

### DRAFT
Belum mempengaruhi saldo final.
- boleh edit;
- boleh hapus/cancel;
- tidak menghasilkan movement final.

### POSTED / EFFECTIVE
Sudah mempunyai efek bisnis.
- tidak boleh update field material langsung;
- tidak boleh delete;
- koreksi menggunakan reversal/revision.

Field material antara lain:
- product;
- quantity;
- Booth;
- Gudang/lokasi;
- harga snapshot;
- payment method;
- shift;
- business date;
- actual stock count.

## DC-003 — Revisi = reverse versi lama + post versi baru

Revisi transaksi yang sudah posted harus dilakukan dalam **satu database transaction atomik**:

```text
Original V1 (POSTED)
      ↓ revise
Reversal V1
      +
Replacement V2 (POSTED)
```

Jika salah satu gagal, semuanya rollback.

## DC-004 — Pembatalan = reversal, bukan delete

Pembatalan posted transaction harus menghasilkan efek kebalikan terhadap seluruh ledger terkait.

Contoh sale:

```text
Sale +2 Matcha
Booth stock -2
Omzet +20.000

VOID SALE
Booth stock +2
Omzet -20.000
Payment -20.000
```

Histori tetap menunjukkan sale asli + void.

## DC-005 — Semua dampak dihitung server-side

Client tidak boleh mengirim saldo baru sebagai authority.

Client mengirim **intensi**:
- void transaction X;
- revise qty 10 → 8;
- actual count = 27;
- payment method Cash → QRIS.

Backend menghitung delta dan semua efek turunannya.

## DC-006 — Stock movement immutable

`stock_movements` adalah ledger yang append-only.

Movement posted:
- tidak boleh UPDATE;
- tidak boleh DELETE.

Kesalahan diperbaiki dengan movement reversal/correction baru yang mereferensikan movement/transaksi asal.

## DC-007 — Snapshot dapat dibangun ulang dari ledger

`warehouse_stocks` dan `booth_stocks` adalah saldo cepat/projection.

Harus tersedia proses internal untuk:
- menghitung ulang saldo dari ledger;
- membandingkan projection vs ledger;
- memberi alert jika berbeda.

## DC-008 — Physical count adalah fakta, jangan di-overwrite

Stok opname/closing count yang sudah `CONFIRMED` adalah bukti hasil hitung fisik pada waktu tertentu.

Jika salah input:
- jangan edit nilai lama;
- buat **recount/revision** baru;
- simpan versi lama;
- buat correction delta yang diperlukan.

## DC-009 — Koreksi histori harus memicu recalculation

Revisi transaksi lama wajib otomatis menghitung ulang semua derived data yang terdampak:
- omzet;
- cup sold;
- payment summary;
- product ranking;
- Booth ranking;
- shift summary;
- expected closing stock;
- discrepancy;
- return reconciliation;
- stock current projection;
- Owner/Admin dashboard.

## DC-010 — Tidak boleh stock negatif akibat koreksi

Sebelum correction diposting, server menjalankan **Impact Preview**.

Jika correction akan menghasilkan saldo negatif atau rantai transaksi yang mustahil, server:
- menolak posting langsung;
- membuat/menandai `RECONCILIATION_REQUIRED`;
- meminta Admin menyelesaikan transaksi dependent atau adjustment yang sah.

Jangan otomatis membuat stok fiktif untuk memaksa balance cocok.

---

# 3. Terminologi correction

## Cancel / Void
Transaksi dianggap tidak berlaku secara bisnis. Sistem membuat reversal penuh.

## Revision
Transaksi tetap ada, tetapi data benar berbeda dari versi awal. Sistem reverse versi lama dan post versi baru.

## Adjustment
Perubahan saldo berdasarkan kejadian koreksi yang tidak tepat dimodelkan sebagai transaksi normal, misalnya selisih opname, barang rusak, salah hitung, atau correction approved.

## Recount
Hitung ulang fisik setelah opname/closing count sebelumnya salah input.

## Reconciliation
Proses mencocokkan beberapa dokumen yang saling terkait setelah ada koreksi historis.

---

# 4. Hak akses koreksi

## Petugas Booth
Boleh:
- edit cart sebelum bayar;
- cancel draft sale sebelum paid;
- revisi qty penerimaan sebelum klik konfirmasi;
- membatalkan restock request selama masih `REQUESTED` jika belum diproses Admin;
- edit closing count selama masih `DRAFT`;
- edit return selama masih `DRAFT` dan belum submit.

Tidak boleh:
- void paid sale;
- revise sale posted;
- revise distribution yang sudah diterima;
- revise received restock;
- revise confirmed stock count;
- revise return yang sudah diterima Gudang;
- membuat arbitrary stock adjustment.

## Admin Pusat
Boleh melakukan correction posted transaction sesuai flow dokumen ini, dengan:
- reason wajib;
- impact preview;
- audit log;
- optional note/evidence.

## Owner
Read-only. Dapat melihat:
- label transaksi direvisi;
- nilai sebelum/sesudah;
- dampak terhadap laporan;
- discrepancy/reconciliation status.

---

# 5. Common metadata seluruh transaksi material

AI Agent harus menerapkan konsep lineage/version pada dokumen transaksional.

Minimum metadata:

```text
id
transaction_group_id   // identitas dokumen lintas versi
version_no             // 1,2,3,...
revision_of_id          // nullable
superseded_by_id        // nullable
reversal_of_id          // nullable
status
posting_status          // DRAFT | POSTED | REVERSED
business_date
posted_at
reversed_at
correction_reason_code
correction_reason_note
created_by
updated_by
created_at
updated_at
row_version
```

Nama kolom dapat menyesuaikan tabel, tetapi semantic wajib dipertahankan.

Untuk entity yang tidak membutuhkan version row penuh, boleh menggunakan tabel generic `transaction_corrections`, selama lineage dapat ditelusuri tanpa ambigu.

---

# 6. Impact Preview wajib

Sebelum Admin menekan **Konfirmasi Pembatalan/Revisi**, backend memberikan preview dampak.

Contoh:

```text
Revisi Sale OBL-00031

Sebelum:
Brown Sugar 2 x 10.000
Omzet +20.000
Stock Brown Sugar -2

Sesudah:
Brown Sugar 1 x 10.000
Omzet +10.000
Stock Brown Sugar -1

Dampak bersih correction:
Omzet -10.000
Brown Sugar +1 cup
Cash -10.000
Shift omzet -10.000
Cup sold -1
```

Untuk correction historis tambahkan:

```text
Shift sudah CLOSED: Ya
Return sudah RECEIVED: Ya
Reconciliation diperlukan: Ya/Tidak
```

---

# 7. Matriks transaksi satu per satu

## TX-01 — Distribusi stok awal Gudang → Booth

### Sebelum `SENT`
Status `DRAFT`:
- bebas revisi Booth/product/qty;
- boleh cancel;
- belum ada saldo final.

### Setelah `SENT`, belum `RECEIVED`
Efek:
- Gudang sudah berkurang/reserved sesuai model;
- stok berada dalam transit.

**Cancel:**
- kembalikan seluruh stock in-transit ke Gudang;
- buat reversal movement;
- status distribution `CANCELLED/REVERSED`;
- audit reason.

**Revision qty/product:**
- reverse shipment lama;
- post shipment versi baru;
- hasil akhir transit mengikuti versi baru.

Contoh 10 → 8:
- reversal +10 ke Gudang;
- shipment baru -8 dari Gudang;
- net Gudang +2 dibanding sebelumnya.

### Setelah `RECEIVED`
Distribusi sudah menjadi stok Booth.

**Revision/cancel Admin-only.**
Server harus mengecek seluruh downstream movement.

Jika stok tersebut belum terpakai dan Booth cukup:
- reversal Booth → Gudang;
- post replacement bila revisi.

Jika sudah terjual/return/closing dan correction akan membuat historical/current stock tidak valid:
- correction tidak boleh membuat balance negatif;
- sistem menjalankan chain reconciliation;
- expected closing/discrepancy dihitung ulang;
- bila tetap membutuhkan keputusan fisik, status `RECONCILIATION_REQUIRED`.

**Dampak otomatis:** warehouse stock, booth stock, in-transit, expected closing, discrepancy, stock report.

---

## TX-02 — Penerimaan distribusi oleh Booth

Penerimaan adalah event konfirmasi fisik.

### Sebelum confirm
Qty actual dapat disesuaikan dengan +/-.

### Setelah confirm
Jangan edit `qty_received` lama.

Jika ternyata salah input:
- Admin buat **Receive Correction**;
- versi lama dipertahankan;
- correction delta diposting.

Contoh sent 10, petugas input received 10, ternyata fisik 9:
- received record V1 = 10;
- correction V2 actual = 9;
- net Booth stock -1;
- discrepancy distribution = -1;
- semua laporan stok mengikuti 9.

Jika correction dilakukan setelah closing, shift discrepancy/reconciliation ikut dihitung ulang.

---

## TX-03 — Sale / Penjualan

### Cart / PENDING
- bebas edit item/qty;
- boleh cancel tanpa audit material;
- belum mempengaruhi omzet/stok final.

### PAID
Sale menjadi immutable.

#### A. Void penuh
Gunakan saat transaksi sebenarnya tidak semestinya ada.

Efek otomatis:
- sale status efektif menjadi VOIDED/REVERSED;
- reverse stock seluruh `sale_items` ke Booth pada effective correction chain;
- reverse payment;
- omzet turun sebesar sale.total;
- cup sold turun;
- product ranking berubah;
- Booth ranking berubah;
- shift total berubah;
- movement reversal per produk;
- receipt tetap dapat dilihat dengan label VOID.

#### B. Revisi qty
Contoh Original qty 2 → qty 1.

Atomic:
1. reverse sale V1;
2. create sale V2 qty 1;
3. post net stock +1;
4. net omzet -harga 1 cup;
5. payment mengikuti total V2.

#### C. Revisi produk
Contoh salah pilih Matcha, sebenarnya Taro.

Atomic:
- Matcha stock +1;
- Taro stock -1;
- omzet menyesuaikan perbedaan harga;
- payment menyesuaikan;
- product sales report direstate.

Harus validate Taro stock tersedia pada correction replay/reconciliation.

#### D. Revisi metode pembayaran saja
Contoh `CASH → QRIS`.

Tidak ada stock effect.
- sale total tetap;
- omzet tetap;
- Cash summary berkurang;
- QRIS summary bertambah;
- payment correction/audit dibuat.

#### E. Revisi harga
Normalnya tidak boleh mengubah harga histori hanya karena master price berubah.

Jika memang transaksi salah harga karena human/system correction:
- Admin correction khusus;
- reason wajib;
- amount/payment/omzet direstate;
- stock tidak berubah jika qty/product sama.

### Sale setelah shift sudah CLOSED
Admin boleh correction, tetapi:
- tampilkan warning besar;
- recalculate shift summary;
- recalculate expected closing stock;
- jangan mengubah actual physical count lama;
- discrepancy dapat berubah;
- return reconciliation dapat berubah;
- correction tercatat sebagai post-close correction.

---

## TX-04 — Payment

V1 memiliki CASH/QRIS.

### Salah metode pembayaran
Gunakan payment revision:
- amount sale tidak berubah;
- omzet tidak berubah;
- payment channel report berubah.

### Salah nominal karena sale berubah
Payment mengikuti sale revision dalam transaksi atomik.

### Void sale
Payment harus direverse bersama sale.

Tidak boleh terjadi sale VOID tetapi payment masih aktif.

Untuk QRIS V1 yang hanya pencatatan internal, reversal adalah reversal record internal. Jika nanti memakai gateway, refund eksternal harus mempunyai state terpisah dan tidak dianggap sukses sebelum gateway confirm.

---

## TX-05 — Restock Request

Restock Request sebelum shipment **belum mempengaruhi stok**.

### REQUESTED
Petugas/Admin dapat cancel sesuai permission.

Petugas dapat revise qty selama belum APPROVED/PREPARED.

### APPROVED / PREPARED
Admin dapat revise approved qty selama belum SENT.

Tidak ada stock movement final sampai shipment mengikuti rule implementasi.

### SENT / RECEIVED
Mulai titik ini koreksi mengikuti aturan **TX-01 Distribusi** dan **TX-02 Penerimaan**.

Cancel request tidak boleh otomatis menghapus shipment yang sudah terjadi.

---

## TX-06 — Restock shipment Gudang → Booth

Restock shipment mempunyai behavior inventory yang sama dengan distribusi stok.

- SENT → Gudang/transit berubah;
- RECEIVED → Booth bertambah;
- cancel/revise posted menggunakan reversal/replacement;
- correction setelah dipakai sale harus chain-aware;
- tidak boleh stock negatif.

Dampak: Gudang, Booth, low-stock alert, expected closing, stock report.

---

## TX-07 — Shift Open

Shift yang belum mempunyai transaksi boleh dibatalkan.

Jika sudah ada distribution/sale/restock:
- jangan delete shift;
- shift harus diselesaikan atau correction dependencynya lebih dulu.

Salah Petugas/Booth/shift template setelah transaksi terjadi:
- jangan update FK langsung;
- Admin gunakan **Shift Correction**;
- hanya field non-material boleh diedit langsung (misalnya note).

Perubahan assignment material harus mempunyai impact preview karena seluruh transaksi shift terikat pada Booth tersebut.

---

## TX-08 — Closing Shift / Stock Count

### CLOSING DRAFT
Petugas boleh edit actual count.

### CONFIRMED / CLOSED
Count tidak boleh di-overwrite.

Jika salah input actual count:
1. Admin/Petugas sesuai permission membuat **Recount**;
2. V1 tetap tersimpan;
3. V2 menjadi accepted physical count;
4. server menghitung delta adjustment terhadap hasil V1/current projection;
5. discrepancy shift dihitung ulang.

Contoh:
- Expected 10
- Count V1 actual 8 → adjustment -2
- Ternyata salah input, fisik sebenarnya 9
- Recount V2 actual 9
- Correction adjustment +1
- Final net discrepancy -1, bukan menghapus adjustment -2.

Jika sale lama direvisi setelah closing:
- expected dapat berubah;
- actual tidak berubah;
- discrepancy direcalculate otomatis.

Ini sangat penting untuk audit.

---

## TX-09 — Stock Return Booth → Gudang (submit)

### DRAFT
Boleh edit/cancel.

### SUBMITTED, belum RECEIVED Gudang
Qty submitted tidak boleh diedit langsung.

Revision:
- create version baru;
- update expected receiving quantity;
- jika ada movement transit, reverse delta sesuai model.

Cancel:
- hanya jika Gudang belum receive;
- restore status stock ke location yang benar;
- audit reason.

### Setelah RECEIVED Gudang
Return adalah transaksi fisik final.

Jika jumlah record salah:
- jangan edit qty_received;
- buat **Return Receipt Correction**.

Contoh recorded received 10, fisik sebenarnya 9:
- correction warehouse -1;
- return discrepancy menjadi -1;
- shift/Booth return summary direstate.

Jika sebenarnya fisik 10 dan hanya submitted salah, correction harus memperbaiki document relation tanpa membuat stock movement ganda.

Sistem harus membedakan:
- kesalahan **dokumen**;
- kesalahan **fisik**.

---

## TX-10 — Gudang menerima Return

Saat receive, warehouse hanya bertambah sesuai **qty actual received**.

Correction setelah receive:
- menggunakan delta terhadap actual benar;
- warehouse stock direconcile;
- reversal/correction movement dibuat;
- original receipt tidak dihapus.

Jika stock hasil return sudah terdistribusi lagi sebelum correction, impact preview wajib memastikan current stock tidak negatif. Bila konflik, buat reconciliation case.

---

## TX-11 — Stock Opname Booth (standalone)

Selain closing count, Admin dapat menjalankan opname Booth kapan saja bila diperlukan.

Flow:
1. pilih Booth;
2. freeze/snapshot expected stock;
3. hitung fisik;
4. input actual dengan +/-;
5. preview selisih;
6. reason wajib untuk selisih material;
7. confirm;
8. sistem membuat adjustment delta.

Formula:

```text
Discrepancy = Actual - Expected
Adjustment Delta = Discrepancy
```

Confirmed opname immutable.

Jika salah input:
- Recount/revision;
- reversal/correction adjustment;
- semua versi disimpan.

Opname tidak boleh mengubah histori penjualan. Ia hanya mengakui selisih fisik inventory.

---

## TX-12 — Stock Opname Gudang

Sama dengan Booth tetapi location = Warehouse.

Dampak hanya inventory Gudang dan discrepancy report.

Tidak boleh memanipulasi omzet atau cup sold.

Jika selisih besar, optional approval workflow dapat ditambahkan kemudian.

---

## TX-13 — Manual Stock Adjustment / Perbaikan Stok

Fasilitas ini hanya untuk Admin dan **bukan jalan pintas untuk mengedit stok**.

Admin harus memilih:
- lokasi;
- produk;
- jenis correction;
- current qty;
- target actual qty atau delta;
- reason code;
- note jika perlu.

Reason minimum:
- DAMAGED;
- SPILLED;
- LOST;
- FOUND;
- DATA_ENTRY_ERROR;
- OPNAME_CORRECTION;
- RETURN_CORRECTION;
- DISTRIBUTION_CORRECTION;
- OTHER.

Sistem menampilkan:

```text
Current: 20
Target: 18
Adjustment: -2
```

Posted adjustment immutable.

Jika adjustment salah:
- reverse adjustment lama;
- buat adjustment baru;
- jangan edit delta lama.

Adjustment tidak mempengaruhi omzet/penjualan kecuali correction itu bagian dari sale revision. Stock adjustment murni hanya inventory.

---

## TX-14 — Customer Sales Return / Refund (dibedakan dari Void)

**Void** dan **Sales Return** tidak boleh disamakan.

- `VOID`: transaksi awal sebenarnya salah/tidak seharusnya ada.
- `SALES_RETURN/REFUND`: transaksi awal benar dan pernah terjadi, lalu kemudian ada kejadian bisnis customer return/refund.

Untuk bisnis minuman, barang yang direfund belum tentu layak masuk kembali ke stok.

Saat membuat sales return, Admin/Petugas sesuai future permission harus memilih kondisi:
- `REFUND_NO_STOCK_RETURN` — uang/omzet dikoreksi, stock tidak bertambah karena produk sudah dikonsumsi/rusak/tidak resellable;
- `REFUND_WITH_STOCK_RETURN` — hanya jika produk fisik benar-benar kembali dan dapat dianggap stock lagi;
- `PARTIAL_REFUND` — nominal/item tertentu.

Efek minimum:
- original sale tetap `PAID`, tidak dihapus;
- create return/refund document baru;
- net omzet turun sesuai refund;
- payment/refund ledger tercatat;
- stock hanya bertambah jika business event menyatakan barang fisik kembali;
- product/Booth ranking menggunakan net sales sesuai definisi laporan.

Jika V1 belum membutuhkan customer return, feature UI boleh ditunda, tetapi AI Agent **jangan menggunakan Void untuk memodelkan kejadian return/refund nyata** karena makna audit berbeda.

---

## TX-15 — Product Price Master

Perubahan harga master:
- hanya berlaku transaksi baru berdasarkan `effective_at`;
- sale lama menggunakan `unit_price` snapshot;
- laporan histori tidak berubah.

Jika sale lama memang salah harga, gunakan **Sale Revision**, bukan mengubah master.

---

## TX-16 — Product/Booth/User/Shift Master

Master yang sudah mempunyai histori:
- tidak hard delete;
- gunakan `active=false`;
- perubahan nama tidak mengubah snapshot histori yang memang perlu snapshot.

Koreksi nama lokasi/metadata boleh update master, tetapi transaksi historis harus tetap dapat dibaca dengan relasi/snapshot yang konsisten.

---

# 8. Stock Opname sebagai fasilitas utama Admin

Tambahkan menu Admin:

```text
Stok
├── Stok Gudang
├── Stok Per Booth
├── Stok Opname
├── Adjustment / Koreksi Stok
└── Riwayat Pergerakan
```

## Screen Stok Opname

Step 1 — Pilih Lokasi
- Gudang Pusat
- Booth A/B/C/...

Step 2 — Snapshot Sistem
Tampilkan current expected.

Step 3 — Hitung Fisik
Gunakan +/- dan quick buttons, minim ketik.

Step 4 — Review Selisih
Merah untuk kurang, biru/hijau untuk lebih.

Step 5 — Konfirmasi
Tampilkan impact.

Setelah confirm:
- opname version locked;
- adjustment movements generated;
- report discrepancy updated;
- dashboard updated.

---

# 9. Menu Koreksi Data Admin

Tambahkan fasilitas terpusat:

## **Riwayat & Koreksi Data**

Admin dapat mencari berdasarkan:
- nomor transaksi;
- tanggal;
- Booth;
- Petugas;
- jenis transaksi;
- status;
- produk.

Pada detail transaksi tampilkan:

### Original
Data awal.

### Riwayat Versi
- V1 Posted
- V2 Revision
- Void/Correction bila ada.

### Dampak
- Stok
- Omzet
- Cup sold
- Payment
- Shift
- Return

Action sesuai eligibility:
- **Batalkan Transaksi**
- **Revisi Transaksi**
- **Lihat Dampak**
- **Lihat Audit Trail**

Action tidak boleh muncul jika business rule melarang.

---

# 10. Correction reason wajib

Semua correction posted harus mempunyai reason.

Suggested reason codes:

```text
WRONG_PRODUCT
WRONG_QTY
WRONG_BOOTH
WRONG_SHIFT
WRONG_PAYMENT_METHOD
DUPLICATE_TRANSACTION
TRANSACTION_NEVER_HAPPENED
WRONG_PHYSICAL_COUNT
DAMAGED
SPILLED
LOST
FOUND
DATA_ENTRY_ERROR
SYSTEM_ERROR
OTHER
```

Jika `OTHER`, note wajib.

---

# 11. Correction setelah periode/shift selesai

Koreksi historis diperbolehkan karena prioritas project adalah **data benar**, bukan sekadar data terkunci.

Namun:
- Admin-only;
- reason wajib;
- beri badge `POST-CLOSE CORRECTION`;
- semua aggregate periode direcalculate;
- report lama dapat berubah;
- simpan `last_recalculated_at`;
- audit menyimpan nilai sebelum/sesudah.

Jika nanti bisnis memerlukan period locking/accounting close, dapat ditambahkan approval khusus. Untuk V1, jangan membuat data salah tidak bisa diperbaiki hanya karena shift sudah closed.

---

# 12. Reconciliation Engine

Koreksi historis harus memanggil proses reconciliation domain.

Minimum output:

```text
stock_balance_changed
warehouse_balance_changed
booth_balance_changed
sales_total_changed
payment_total_changed
shift_summary_changed
closing_expected_changed
closing_discrepancy_changed
return_summary_changed
owner_kpi_changed
reconciliation_required
```

Jika `reconciliation_required = true`, buat record `reconciliation_cases`.

Contoh reason:
- correction creates negative historical stock;
- received return sudah dipakai distribusi lain;
- physical count conflict;
- dependent transaction chain inconsistent.

Admin Dashboard harus menampilkan alert **Perlu Rekonsiliasi**.

---

# 13. Database tambahan yang direkomendasikan

## `transaction_corrections`

```text
id uuid PK
entity_type text
entity_id uuid
transaction_group_id uuid
correction_type VOID|REVISION|RECOUNT|ADJUSTMENT|PAYMENT_CORRECTION
original_version_id uuid nullable
replacement_version_id uuid nullable
reason_code text
reason_note text nullable
impact_snapshot jsonb
status PENDING|POSTED|FAILED
created_by uuid
created_at timestamptz
posted_at timestamptz nullable
idempotency_key uuid unique
```

## `stock_opnames`

```text
id uuid PK
opname_no text unique
location_type WAREHOUSE|BOOTH
booth_id uuid nullable
business_date date
status DRAFT|CONFIRMED|SUPERSEDED
transaction_group_id uuid
version_no int
revision_of_id uuid nullable
snapshot_at timestamptz
confirmed_at timestamptz nullable
counted_by uuid
correction_reason_code text nullable
note text nullable
```

## `stock_opname_items`

```text
id uuid PK
stock_opname_id uuid FK
product_id uuid FK
expected_qty int
actual_qty int
discrepancy_qty int
adjustment_movement_id uuid nullable
reason_code text nullable
reason_note text nullable
```

## `reconciliation_cases`

```text
id uuid PK
case_no text unique
source_entity_type text
source_entity_id uuid
status OPEN|RESOLVED|IGNORED
severity INFO|WARNING|CRITICAL
reason_code text
details jsonb
resolved_by uuid nullable
resolved_at timestamptz nullable
resolution_note text nullable
created_at timestamptz
```

## `payments` additions

Tambahkan minimum:

```text
status POSTED|REVERSED|SUPERSEDED
transaction_group_id uuid
version_no int
revision_of_id uuid nullable
reversal_of_id uuid nullable
```

---

# 14. Reporting rules setelah correction

## Omzet bersih

```text
Net Sales = Posted Sales - Voided/Reversed Sales + Replacement Sales
```

Secara implementasi lebih aman membaca **effective sale versions**, bukan menjumlah semua row tanpa status filter.

## Cup Sold
Hanya sale version yang effective/posted dan tidak superseded/voided.

## Payment
Report Cash/QRIS mengikuti effective payment versions.

## Stok
Current stock = projection dari effective stock movements + correction movements.

## Discrepancy
Discrepancy menggunakan:
- expected hasil ledger/recalculation;
- latest accepted physical count;
- tidak menghapus physical count lama.

## Dashboard Owner
Selalu tampilkan nilai net/effective terbaru.

Jika ada correction pada data periode yang sedang dilihat, optional badge:

**“Data telah direvisi”**

---

# 15. API/RPC correction contract minimum

AI Agent wajib menyediakan domain operation berikut (nama boleh disesuaikan):

```text
preview_transaction_correction(entity_type, entity_id, proposed_change)
void_sale(sale_id, reason, idempotency_key)
revise_sale(sale_id, replacement_items/payment, reason, idempotency_key)
revise_payment(payment_id, new_method, reason, idempotency_key)
cancel_distribution(distribution_id, reason, idempotency_key)
revise_distribution(distribution_id, replacement_items, reason, idempotency_key)
correct_distribution_receipt(distribution_id, corrected_received_items, reason, idempotency_key)
cancel_restock_request(request_id, reason, idempotency_key)
revise_restock_request(request_id, items, reason, idempotency_key)
revise_stock_return(return_id, corrected_items, reason, idempotency_key)
correct_return_receipt(return_id, corrected_received_items, reason, idempotency_key)
create_stock_opname(location, items, reason, idempotency_key)
revise_stock_opname(opname_id, corrected_items, reason, idempotency_key)
create_stock_adjustment(location, product, target_qty, reason, idempotency_key)
reverse_stock_adjustment(adjustment_id, reason, idempotency_key)
reconcile_transaction_chain(source_entity_type, source_entity_id)
```

Seluruh mutation harus atomic, idempotent, dan mempunyai authorization server-side.

---

# 16. UI correction flow

Untuk Admin, gunakan pola yang sama di seluruh modul:

```text
Detail Transaksi
      ↓
[Revisi] / [Batalkan]
      ↓
Pilih alasan
      ↓
Masukkan data koreksi menggunakan click/+/-
      ↓
Preview Dampak
      ↓
Konfirmasi
      ↓
Success + nomor correction
```

Gunakan warna:
- hijau: effect positif/valid;
- merah: reversal/pengurangan/warning;
- kuning: memerlukan reconciliation.

Hindari tombol "Edit" biasa pada posted transaction karena memberi kesan row dapat ditimpa.

Gunakan label:
- **Revisi Transaksi**
- **Batalkan Transaksi**
- **Koreksi Penerimaan**
- **Hitung Ulang / Recount**

---

# 17. Acceptance cases wajib

## COR-01 — Void sale normal
Sale 2 Matcha @10.000.
Setelah void:
- omzet -20.000;
- cup sold -2;
- Booth stock +2;
- payment reversed;
- original sale tetap ada;
- movement reversal ada.

## COR-02 — Revise sale qty
Sale qty 2 → 1.
Final:
- net omzet 10.000;
- net sold qty 1;
- stock hanya berkurang 1;
- report hanya menghitung V2 sebagai effective sale.

## COR-03 — Revise payment Cash → QRIS
- stock tidak berubah;
- omzet tidak berubah;
- Cash -amount;
- QRIS +amount.

## COR-04 — Cancel sent distribution
Sent 10 belum receive.
Cancel:
- transit 0;
- warehouse kembali +10;
- Booth tidak berubah.

## COR-05 — Correct received distribution
Recorded 10, actual 9.
Correction:
- Booth -1;
- discrepancy -1;
- original receipt immutable.

## COR-06 — Revise sale after closing
Sale qty 2 → 1 setelah shift closed.
- shift omzet recalc;
- expected closing recalc;
- actual physical count tidak berubah;
- discrepancy recalc;
- return reconciliation dijalankan.

## COR-07 — Recount closing
Expected 10; V1 actual 8; V2 actual 9.
Net stock adjustment harus -1 dari expected, bukan -3 atau overwrite V1.

## COR-08 — Return receipt correction
Recorded warehouse received 10, actual 9.
- warehouse correction -1;
- return discrepancy direstate;
- audit lengkap.

## COR-09 — Adjustment reversal
Adjustment -3 salah.
Reverse adjustment:
- stock +3;
- original adjustment tetap ada;
- net adjustment 0.

## COR-10 — Negative prevention
Correction yang akan membuat historical/current stock negatif harus gagal atau membuka reconciliation case; tidak boleh commit saldo negatif.

## COR-11 — Dashboard restatement
Historical sale revised.
Admin dan Owner dashboard harus menampilkan nilai terbaru tanpa cache stale.

## COR-12 — Double submit correction
Request correction dengan idempotency key sama hanya boleh diposting sekali.

## COR-13 — No hard delete
Database test memastikan posted transaction tidak dapat di-delete oleh role aplikasi.

## COR-14 — Projection integrity
Rebuild balance dari `stock_movements` harus sama dengan `warehouse_stocks/booth_stocks` setelah seluruh correction selesai.

---

# 18. Definition of Done khusus konsistensi data

Fitur transaksi belum dianggap selesai sebelum:

- mempunyai lifecycle DRAFT/POSTED sesuai kebutuhan;
- posted row tidak dapat diedit/hard-delete;
- mempunyai cancel/reversal rule;
- mempunyai revision rule;
- mempunyai reason/audit;
- mempunyai idempotency;
- mempunyai impact preview untuk Admin;
- mempunyai stock/financial reconciliation;
- report memakai effective/net data;
- test reversal dan revision lulus;
- projection stok dapat direbuild dari ledger;
- correction historis tidak mengubah physical count lama secara diam-diam.

---

# 19. Keputusan final untuk AI Coding Agent

Untuk project Obbel, **kebenaran data lebih penting daripada kemudahan mengubah row database**.

AI Agent dilarang membuat fitur koreksi dengan pola seperti:

```sql
UPDATE sales SET qty = ...
UPDATE booth_stocks SET qty_on_hand = ...
DELETE FROM stock_movements ...
```

untuk transaksi posted.

Implementasi yang benar adalah:

```text
VALIDATE
→ IMPACT PREVIEW
→ REVERSE ORIGINAL EFFECT
→ POST REPLACEMENT/CORRECTION
→ RECALCULATE DEPENDENCIES
→ UPDATE PROJECTION
→ AUDIT
→ COMMIT ATOMICALLY
```

Dengan pola ini, stok, omzet, penjualan, pembayaran, closing, return, dan laporan tetap dapat ditelusuri dan konsisten meskipun manusia melakukan salah input atau transaksi harus diperbaiki di kemudian hari.
