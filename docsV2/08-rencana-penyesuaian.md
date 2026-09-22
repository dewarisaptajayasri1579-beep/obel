# 08 — Rencana Penyesuaian

Urutan pengerjaan yang paling efektif untuk mencapai satu tujuan: **riwayat dan rekap
stok yang konsisten dan valid**.

Dokumen ini **mengganti urutan tahap di [04-migrasi.md](04-migrasi.md)**. Isi teknis
dok 04 tetap berlaku; yang berubah hanya urutannya.

---

## 1. Kenapa urutan di dok 04 perlu diganti

Dok 04 memulai dari migrasi terberat: `BoothStock` → `ShiftStock` plus penulisan ulang
seluruh ledger. Itu urutan yang benar kalau tujuannya "menyelesaikan seluruh docsV2",
tapi salah kalau tujuannya "riwayat & rekap yang valid".

Tiga alasan:

1. **Belum ada yang membuktikan data sekarang konsisten.** Kalau `stock_movements` yang
   ada hari ini ternyata sudah tidak cocok dengan saldonya, migrasi akan membawa
   ketidakcocokan itu ke skema baru — dan di sana ia akan menyamar sebagai "bug migrasi"
   yang berhari-hari ditelusuri ke tempat yang salah.
2. **Masalah utama Anda bisa diselesaikan tanpa migrasi apa pun.** Tabel
   `stock_movements` sudah terisi lengkap sejak lama. Yang tidak ada hanyalah cara
   membacanya. Riwayat bisa muncul di minggu pertama, bukan di bulan ketiga.
3. **Perubahan besar tanpa alat ukur adalah tebakan.** Verifikator harus dibangun
   sebelum yang diverifikasi berubah, supaya ada pembanding "sebelum".

---

## 2. Urutan yang diusulkan

```
  G0  Verifikator          ── membuktikan kondisi sekarang        ~2 hari
       │
  G1  Riwayat di atas      ── masalah utama hilang                ~4 hari
       skema lama             tanpa mengubah skema
       │
  G2  Skema baru           ── dipagari verifikator di dua ujung   ~2 minggu
       │
  G3  Transaksi & master   ── pola UI jsBerkah                    ~3 minggu
       baru
```

Tiap gelombang berdiri sendiri: kalau berhenti di G1, aplikasi tetap lebih baik dari
sekarang dan tidak ada yang setengah jadi.

---

## 3. Gelombang 0 — Verifikator lebih dulu

**Tanpa migrasi. Tanpa perubahan skema. Tanpa sentuh UI.**

Satu script yang menjawab: apakah saldo hari ini bisa dijelaskan oleh ledger hari ini?

```
backend/scripts/reconcile-stock.ts
npm run stock:reconcile
```

Yang diperiksa per produk × lokasi, memakai tabel yang ada sekarang:

| # | Pemeriksaan | Kalau gagal artinya |
|---|---|---|
| 1 | `Σ(movement bertanda)` == `WarehouseStock.qtyOnHand` | Ada mutasi yang tidak tercatat, atau saldo pernah diubah di luar ledger |
| 2 | `Σ(movement bertanda)` == `BoothStock.qtyOnHand` per booth | sda, di sisi booth |
| 3 | Tiap `movement` punya dokumen sumber yang masih ada | Ada dokumen terhapus yang menyisakan mutasi yatim |
| 4 | Tiap sale `PAID` punya movement pasangannya | Ada penjualan yang tidak mengurangi stok |
| 5 | Tiap distribusi `RECEIVED` punya dua movement | Ada perpindahan yang cuma tercatat sebelah |

Output: laporan selisih per produk × lokasi, dengan daftar dokumen di sekitar titik
melencengnya.

**Ini keputusan gerbang.** Kalau G0 melaporkan 0 selisih, lanjut dengan tenang. Kalau
ada selisih, selesaikan dulu — jangan dibawa ke skema baru.

Script ini tidak dibuang setelah migrasi. Ia jadi alat permanen: cron harian yang
mengirim notifikasi kalau ada selisih. Inilah wujud konkret dari "konsisten dan valid" —
sesuatu yang dijalankan, bukan diharapkan.

---

## 4. Gelombang 1 — Riwayat di atas skema lama

**Masih tanpa migrasi.** Membaca `stock_movements` apa adanya.

### Backend

Modul baru `stock-movements`, read-only:

| Endpoint | Guna |
|---|---|
| `GET /stock-movements` | Daftar + filter produk, lokasi, jenis, periode |
| `GET /stock-movements/kartu-stok` | Kartu stok satu produk × lokasi dengan saldo berjalan |
| `GET /stock-movements/by-doc` | Mutasi dari satu dokumen |
| `GET /stock-recap` | Rekap bulanan, **dihitung on-the-fly** dari movement |

Arah mutasi (`+`/`−`) disimpulkan di **satu** helper:

```ts
// src/modules/stock-movements/arah.util.ts
/// Penyimpulan arah dari skema LAMA yang qty-nya selalu positif. Sengaja
/// diisolasi di satu file supaya saat skema baru punya qty_change bertanda
/// (dok 02), file ini dihapus dan tidak ada sisa logika yang tertinggal
/// di tempat lain.
export function arahMutasi(m: StockMovement, lokasi: Lokasi): number { … }
```

Jelek, tapi terisolasi dan berumur pendek. Jauh lebih baik daripada menunda riwayat
sampai skema selesai.

Rekap masih dihitung langsung dari movement — untuk volume Obbel sekarang masih cepat,
dan tabel `rekap_stok` menyusul di G2 tanpa mengubah kontrak API-nya.

### Web

| Halaman | Isi |
|---|---|
| `/stok/riwayat` | Riwayat lintas lokasi |
| `/stok/gudang` → tab Riwayat | Kartu stok gudang |
| `/stok/booth` → tab Riwayat | Kartu stok per booth |
| `/laporan/rekap-stok` | Rekap bulanan |

**Selesai G1, masalah utama Anda sudah hilang** — riwayat ada, rekap ada, dan keduanya
terbukti cocok dengan saldo karena G0 memastikannya.

---

## 5. Gelombang 2 — Skema baru

Baru di sini skema berubah, dengan verifikator sudah terpasang di kedua ujung.

| Langkah | Isi | Gerbang |
|---|---|---|
| 2.1 | `ShiftStock` menggantikan `BoothStock` (dok 07) | reconcile 0 selisih |
| 2.2 | `mutasi_stok` + backfill dari `stock_movements` | reconcile 0 selisih **dan** hasilnya sama persis dengan G1 |
| 2.3 | `StockLedgerService` jadi pintu tulis tunggal; 7 service dialihkan | seluruh e2e hijau |
| 2.4 | `rekap_stok` + pemeliharaan inkremental | hasil rebuild == hasil inkremental |
| 2.5 | Hapus `arah.util.ts`; endpoint G1 dialihkan ke tabel baru | kontrak API tidak berubah |

Uji paling penting di 2.2: jalankan endpoint rekap G1 (baca skema lama) dan endpoint
rekap G2 (baca skema baru) untuk periode yang sama, lalu bandingkan. Harus identik.
Kalau tidak, backfill-nya salah — dan Anda mengetahuinya sebelum data lama dibuang.

Dual-write ke `stock_movements` dipertahankan sepanjang G2 dan baru dihentikan setelah
satu periode penuh tanpa selisih.

---

## 6. Gelombang 3 — Transaksi & master baru

Barulah fitur baru, dengan urutan mengikuti ketergantungannya:

| # | Modul | Bergantung pada |
|---|---|---|
| 3.1 | Master `Warehouse` | — |
| 3.2 | Master `Supplier` | — |
| 3.3 | Penerimaan Stok (dok 01) | 3.1, 3.2 |
| 3.4 | Stok Rusak (dok 05 §4) | G2 |
| 3.5 | `StockThreshold` gabungan + `StockAlert` (dok 06 §7) | G2 |
| 3.6 | Riwayat harga jual | — |

---

## 7. jsBerkah sebagai referensi tampilan

**Batasnya tegas: yang diambil hanya tampilan.** Model data, alur transaksi, aturan
bisnis, dan arsitektur Obel berasal dari docsV2 dan spesifikasi Obbel sendiri — bukan
dari jsBerkah. Keduanya bisnis yang berbeda: jsBerkah punya supplier, hutang, jurnal,
sales keliling, dan toko titipan; Obbel punya booth, shift, dan petugas yang
bertanggung jawab atas stok selama jam tugasnya.

Kemiripan yang tampak di docsV2 — buku besar stok, saldo bulanan, pemisahan tanggal
bisnis — bukan hasil menyalin jsBerkah, melainkan karena keduanya menghadapi persoalan
yang sama: mencatat pergerakan stok yang bisa diaudit. Kalau suatu saat kebutuhan Obbel
berbeda, yang menang adalah kebutuhan Obbel.

### Yang sudah sama

Komponen UI kedua proyek **identik** — dari template internal yang sama:

```
Accordion · Alert · Autocomplete · Badge · Breadcrumb · Button · Card · Checkbox
CollapsibleCard · ColumnVisibilityMenu · CurrencyInput · DatePicker · DateRangePicker
Dropdown · ErrorState · FileUpload · FilterableTable · Input · InputMask · Modal
MultiSelect · Pagination · Radio · SearchableSelect · Select · Skeleton · Spinner
StatTile · StatusBadge · Switch · Table · Tabs · TagInput · Textarea · TimePicker
Toast · Tooltip · charts/
```

plus `use-column-visibility.ts`, `use-pagination.ts`, `datetime.ts`, `nav-config.ts`.

**Tidak ada porting komponen.** Yang perlu diadopsi adalah **pola halamannya**.

### Yang perlu disalin — helper presentasi saja

| Dari jsBerkah | Guna |
|---|---|
| `lib/format.ts` | Format Rupiah & angka konsisten di seluruh halaman |
| `lib/report-period.ts` | Resolusi filter periode di UI (Hari Ini / Bulan Ini / Custom) |
| `lib/pagination.ts` | Kontrak paginasi seragam |
| `lib/pdf-print.ts` | Cetak dokumen |
| `lib/download-filename.ts` | Penamaan file ekspor |
| `ui/PortalMenu.tsx` | Menu aksi per baris tabel |
| `ui/RincianKonfirmasi.tsx` | Modal konfirmasi sebelum posting |

Ketujuhnya murni presentasi — tidak ada aturan bisnis di dalamnya. Satu yang perlu
diperiksa saat menyalin: `report-period.ts` menghitung batas periode memakai zona waktu
server. Obel harus mengunci ke `Asia/Jakarta`, dan batas periode yang dipakai UI wajib
sama persis dengan yang dipakai backend saat menghitung rekap — kalau berbeda, mutasi di
jam-jam pinggir bulan akan jatuh ke periode yang berbeda antara yang ditampilkan dan
yang dihitung.

### Pola halaman transaksi

Dari `pembelian/penerimaan-barang` — dipakai untuk Penerimaan Stok, Stok Rusak,
Penyerahan, dan Pengembalian:

```
<Modul>/
├── page.tsx                      server component, ambil data awal
├── <Modul>Panel.tsx              tabel + filter + aksi (client)
├── baru/
│   ├── page.tsx
│   ├── <Modul>Form.tsx           form input
│   ├── <Modul>PreviewModal.tsx   konfirmasi sebelum posting
│   └── <Modul>Printable.tsx      versi cetak
└── [id]/
    ├── page.tsx                  detail
    └── <Modul>DetailActions.tsx  posting / batal / revisi
```

Enam kebiasaan yang membuat pola ini bekerja, dan wajib diikuti:

1. **Baris tabel bisa di-expand** menampilkan item dokumen inline — tidak perlu pindah
   halaman untuk melihat isi.
2. **Toggle kolom** lewat `ColumnVisibilityMenu`, pilihannya disimpan per pengguna.
3. **Filter periode seragam**: Semua / Hari Ini / Bulan Ini / Tahun Ini / Custom.
4. **Pemisahan Simpan Draft vs Posting** sebagai dua tombol berbeda, dengan modal
   konfirmasi hanya pada Posting.
5. **Menu aksi per baris** yang isinya menyesuaikan status dokumen — bukan tombol yang
   selalu tampil lalu menolak saat diklik.
6. **Komponen Printable terpisah** dari komponen layar.

### Pola halaman master

Dari `master/*`: tabel + pencarian + toggle aktif/nonaktif + modal tambah/ubah. Master
tidak pernah dihapus, hanya dinonaktifkan — data transaksi lama harus tetap bisa
menunjuk ke sana.

### Yang JANGAN diikuti

jsBerkah adalah Next.js + Prisma yang berbicara **langsung ke database** lewat
`app/api/*` dan `lib/prisma.ts`. Obel tidak begitu: `admin_web` adalah klien tipis di
atas NestJS, dan itu keputusan yang benar karena ada dua aplikasi Flutter yang harus
memakai aturan bisnis yang sama.

Jadi yang diambil adalah **lapisan presentasinya saja**. Jangan menyalin `app/api/*`,
`lib/prisma.ts`, atau logika domain apa pun yang ada di dalam komponen React —
semuanya tetap di backend NestJS.

---

## 8. Bikin baru atau modifikasi yang ada?

**Modifikasi.** Bukan karena menulis ulang itu selalu salah, tapi karena dalam kasus ini
yang rusak bukan fondasinya.

### Yang sudah benar di Obel sekarang

Penulisan stoknya sebenarnya disiplin — ini bagian yang paling mahal dibangun ulang dan
paling mudah salah:

- Setiap pengurangan memakai guard `qtyOnHand: { gte: qty }` dalam satu statement SQL,
  bukan baca-lalu-tulis. Stok tidak bisa negatif karena balapan.
- Semua mutasi berjalan di dalam `prisma.$transaction`.
- Harga di-snapshot ke `SaleItem.unitPrice`, jadi mengubah harga master tidak pernah
  merestate omzet histori.
- Idempotency key sudah dipasang di transaksi kritis.
- Sistem koreksi/reversal lengkap dengan impact preview dan `ReconciliationCase` —
  ini bagian tersulit di seluruh sistem, sudah ada dan sudah punya e2e test.

Ditambah dua aplikasi Flutter, adapter printer Bluetooth, dan 22 modul backend yang
sudah berjalan.

### Yang bermasalah

Satu hal: **lapisan bacanya tidak pernah dibuat.** Data mutasinya ada dan terindeks,
tapi tidak ada endpoint yang membacanya. Itu kekurangan, bukan kerusakan — dan
kekurangan ditambal, tidak diganti.

Sisanya adalah fitur yang memang belum pernah dibuat: penerimaan stok, stok rusak,
master gudang, early warning. Semuanya penambahan.

### Satu perubahan yang memang invasif

`BoothStock` → `ShiftStock` dan `qty` → `qty_change` bertanda menyentuh tujuh service.
Tapi tujuh service adalah pekerjaan terukur beberapa hari, sementara menulis ulang
berarti membangun kembali dua aplikasi Flutter, seluruh sistem koreksi/reversal, dan
autentikasi — berbulan-bulan, untuk mendapatkan tempat yang sama.

Perlu diperhatikan: G2 sebenarnya **sudah mengandung penulisan ulang** — tapi terbatas
pada inti stoknya saja, dengan tabel baru dibangun berdampingan dan verifikator sebagai
pagar di kedua ujung. Itu cara mendapatkan manfaat "skema bersih" tanpa menanggung
risiko "semuanya baru sekaligus".

### Kapan menulis ulang justru lebih murah

Satu kondisi, dan hanya diketahui setelah G0:

> Kalau verifikator menemukan bahwa ledger yang ada **sudah tidak konsisten sejak lama**
> — bukan satu-dua selisih, tapi rusak menyeluruh — **dan** data produksinya masih
> sedikit sehingga bisa diinput ulang, maka memulai dari skema bersih dengan data baru
> lebih murah daripada merekonstruksi riwayat yang tidak bisa dipercaya.

Yang ditulis ulang pun tetap hanya **datanya**, bukan aplikasinya.

Jadi: jalankan G0 dulu. Ia menjawab pertanyaan ini dengan data, bukan dengan firasat.

---

## 9. Ringkasan urutan

| Gelombang | Hasil | Perkiraan |
|---|---|---|
| **G0** | Bukti bahwa data sekarang konsisten (atau daftar masalahnya) | ~2 hari |
| **G1** | Riwayat & rekap tampil — **masalah utama selesai** | ~4 hari |
| **G2** | Skema ledger baru, terbukti identik dengan hasil G1 | ~2 minggu |
| **G3** | Penerimaan, stok rusak, gudang, supplier, early warning | ~3 minggu |

Kalau hanya ada waktu untuk satu hal: **kerjakan G0 dan G1**. Dua-duanya tidak menyentuh
skema, tidak bisa merusak data yang ada, dan sudah menyelesaikan persoalan yang Anda
sebut sebagai masalah utama.
