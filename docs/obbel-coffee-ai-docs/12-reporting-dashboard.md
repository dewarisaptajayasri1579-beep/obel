# 12 — Reporting & Dashboard Definitions

## 1. Period presets
Semua app menggunakan preset konsisten:
- Hari Ini
- Kemarin (Admin optional)
- 7 Hari
- Bulan Ini
- Custom (Admin report only)

Period dihitung Asia/Jakarta.

## 2. KPI definitions

### Omzet
```text
SUM(sales.total)
WHERE status = PAID
AND paid_at within period
```
Exclude VOIDED.

### Cup Terjual
```text
SUM(sale_items.qty)
JOIN sales PAID
```

### Transaksi
Count sales PAID.

### Booth Aktif
Definisi default dashboard harian: Booth memiliki shift session OPEN/CLOSING pada saat ini. Admin dapat melihat Booth master active terpisah.

### Rata-rata Omzet/Booth
Omzet / jumlah Booth yang memiliki transaksi pada period. Label harus jelas agar tidak ambigu.

## 3. Booth ranking
Urutan default: omzet desc.
Tie breaker: cup sold desc, lalu Booth name.

Tampilkan omzet + cup sold.

## 4. Product ranking
Urutan default: qty sold desc.
Tambahkan revenue contribution bila dibutuhkan.

## 5. Stock condition
Per Booth-product:
- Aman
- Menipis
- Kritis
- Habis

Dashboard global menampilkan count item, bukan sum cup, kecuali label menyebut cup.

## 6. Shift report
Per shift:
- Booth;
- Petugas;
- scheduled/open/close time;
- opening/received quantities;
- restock;
- cup sold;
- omzet;
- expected closing stock;
- actual closing stock;
- discrepancy;
- return submitted/received.

## 7. Stock movement report
Filter:
- date;
- product;
- Booth;
- movement type;
- reference.

Kolom:
- timestamp;
- product;
- qty;
- from;
- to;
- type;
- ref no;
- actor.

## 8. Discrepancy report
- business date;
- Booth;
- shift;
- product;
- expected;
- actual;
- difference;
- reason;
- estimated value;
- staff;
- status review optional.

## 9. Owner attention rules
Urutan:
1. discrepancy qty/value terbesar;
2. out/critical stock;
3. Booth with no activity while scheduled open;
4. performance below baseline bila historical baseline cukup.

Untuk V1, poin 1–2 wajib; 3–4 dapat P1.

## 10. Admin dashboard first viewport
Maksimal KPI inti:
- omzet;
- cup;
- Booth aktif;
- stock alert.

Action queue:
- restock pending;
- return pending;
- discrepancy.

## 11. Export
Admin:
- CSV/XLSX minimal.
- Print browser.

Owner:
- export/report share optional P1.

File export harus menggunakan timezone dan format Rupiah yang benar.

## Reporting setelah revision/cancellation

Semua KPI menampilkan **effective/net state** terbaru.

- Omzet tidak menghitung sale VOIDED dan hanya menghitung effective sale version.
- Cup sold mengikuti effective sale items.
- Cash/QRIS mengikuti effective payment version.
- Product/Booth ranking direstate setelah revision.
- Shift summary direstate bila correction historis terjadi.
- Physical count lama tidak ditimpa; discrepancy dihitung terhadap expected terbaru dan latest accepted count.
- Stock current mengikuti effective ledger + correction movements.

Admin report harus menyediakan audit view:
- Gross posted;
- Void/reversal;
- Revision delta;
- Net effective.

Owner default hanya melihat nilai net/effective. Optional badge `Data telah direvisi` dapat muncul untuk period yang mempunyai post-close correction.

Tambahkan Admin KPI/alert:
- correction hari ini;
- open reconciliation cases;
- projection mismatch (harus 0 pada kondisi sehat).
