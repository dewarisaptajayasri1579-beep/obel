# 16 — Seed & Dummy Data

Data ini untuk prototype/dev. Admin harus dapat mengubahnya.

## 1. Product categories
- Coffee Milk
- Non Coffee
- Coffee

## 2. Products berdasarkan referensi menu

| SKU | Nama | Kategori | Harga |
|---|---|---|---:|
| OBL-ORI | Original | Coffee Milk | 8000 |
| OBL-BSG | Brown Sugar | Coffee Milk | 10000 |
| OBL-SC | Salted Caramel | Coffee Milk | 10000 |
| OBL-ALM | Almond | Coffee Milk | 10000 |
| OBL-BSC | Butter Scotch | Coffee Milk | 10000 |
| OBL-KPD | Kopsu Pandan | Coffee Milk | 10000 |
| OBL-KPO | Kopsu Premium Ori | Coffee Milk | 12000 |
| OBL-KPR | Kopsu Premium Rasa | Coffee Milk | 13000 |
| OBL-MAT | Matcha | Non Coffee | 10000 |
| OBL-TAR | Taro | Non Coffee | 10000 |
| OBL-CHO | Chocolate | Non Coffee | 10000 |
| OBL-RV | Red Velvet | Non Coffee | 10000 |
| OBL-AMR | Americano | Coffee | 10000 |

Harga adalah data referensi dari materi visual dan tetap harus configurable.

## 3. Known location references
Gunakan sebagai seed sementara bila diinginkan:
1. Depan Galaxy Jl. Pandanaran
2. Depan Rumah Dinas Bupati
3. Barat Pasar Ngebong
4. Depan Pom Bensin Kemiri Kab. Boyolali
5. Barat Tugu Keris Boyolali
6. Depan SMP 3 Boyolali
7. Depan MI Salfiyah Tukangan Ampel Boyolali
8. Depan SMK 1 Klaten
9. Depan Stadion/Tri Koyo Klaten
10. Jl. Mayor Kusmanto No.82 Klaten

Nama/alamat final harus diverifikasi Admin. Jangan menganggap list ini seluruh Booth aktif.

## 4. Staff count
Brief menyebut sekitar 14 penjaga. Jangan seed identitas nyata tanpa data. Buat user dummy seperti `staff01`, `staff02` untuk development.

## 5. Shift templates
Karena jam operasional dapat berubah, seed contoh:
- Shift 1 — configurable
- Shift 2 — configurable

Jangan mengunci jam berdasarkan contoh mockup.

## 6. Stock thresholds dummy
Untuk development:
- minimum_qty: 5
- critical_qty: 2

Atau per Booth-product. Production harus diset Admin sesuai kebutuhan riil.

## 7. Dummy warehouse stock
Set 100–300 cup/product agar semua flow dapat dites.

## 8. Dummy role users
- admin@dev.local — ADMIN
- owner@dev.local — OWNER
- booth01@dev.local — BOOTH_STAFF

Credential jangan digunakan production.

## 9. Visual assets
Referensi:
- `references/04-instagram-profile-reference.png`
- `references/05-menu-reference.png`
- `references/06-location-reference.png`

Jangan crop/menyalin screenshot Instagram langsung sebagai production asset; gunakan logo/product image asli ketika tersedia.
