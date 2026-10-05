# 09 — API / RPC Contract

Dokumen ini mendefinisikan use-case contract. Nama RPC boleh disesuaikan, tetapi behavior tidak boleh berubah tanpa update dokumentasi.

## 1. Query operations

### `get_my_active_shift()`
Untuk Booth Staff.
Return:
```json
{
  "shift_session_id": "uuid",
  "booth": {"id":"uuid","code":"A","name":"Booth A"},
  "status": "OPEN",
  "scheduled_start_at": "...",
  "scheduled_end_at": "..."
}
```

### `get_booth_pos_catalog(booth_id)`
Return product aktif, category, sell price, image, current Booth stock, stock status.

### `get_booth_home_summary(shift_session_id)`
Return omzet, cup sold, transaction count, low stock count, pending inbound.

### `get_admin_dashboard(period)`
Return KPI global, Booth cards, actionable alerts.

### `get_owner_dashboard(period)`
Read-only aggregate.

## 2. Mutation RPC — receive distribution
### `receive_distribution`
Input:
```json
{
  "distribution_id": "uuid",
  "idempotency_key": "uuid",
  "items": [
    {"product_id":"uuid","qty_received":10}
  ]
}
```
Server:
- validate role/Booth;
- validate status SENT;
- compare qty;
- update status RECEIVED or DISCREPANCY;
- update Booth stock;
- post movements;
- audit.

## 3. Create sale
### `create_paid_sale`
Input:
```json
{
  "idempotency_key":"uuid",
  "shift_session_id":"uuid",
  "payment_method":"CASH",
  "items":[
    {"product_id":"uuid","qty":1}
  ]
}
```
Jangan kirim unit_price sebagai authority.

Split memakai `payments` (>=2 baris CASH/QRIS, jumlahnya pas = total) sebagai pengganti `payment_method`. Kalau ada pembayaran QRIS, petugas booth wajib mengirim `qris_proof_photo_url`: URL hasil `POST /sales/payment-proof/photo` (multipart, field `file`, JPG/PNG/WEBP/GIF maks 5MB, return `{ "photoUrl": "..." }`). URL di luar `/uploads/payment-proofs/` ditolak. Aturan yang sama berlaku untuk `POST /sales/:id/pay` (melunasi draft).

Return:
```json
{
  "sale_id":"uuid",
  "sale_no":"OBL-...",
  "total":20000,
  "paid_at":"...",
  "remaining_stock":[...]
}
```

Error codes:
- `SHIFT_NOT_OPEN`
- `UNAUTHORIZED_BOOTH`
- `PRODUCT_INACTIVE` — juga saat membayar draft yang produknya sudah dinonaktifkan
- `INSUFFICIENT_STOCK`
- `INVALID_QTY`
- `QRIS_PROOF_REQUIRED` — petugas booth membayar QRIS tanpa foto bukti (BR-038)

## 4. Create restock request
### `create_restock_request`
Input booth derived from shift, product + qty.

Qty per produk tidak boleh melebihi stok Gudang (juga saat revisi `POST /restock-requests/:id/revise`): error `RESTOCK_EXCEEDS_WAREHOUSE` dengan details `{ productId, requested, available }`. Petugas membaca stok Gudang lewat `GET /warehouse-stock` (role BOOTH_STAFF diizinkan, read-only).

Return request id/status.

## 5. Approve restock
### `approve_restock_request`
Admin only.
Input item approved quantities.

## 6. Send restock
### `send_restock`
Admin only.
Atomically validates/deducts warehouse source and sets SENT.

## 7. Receive restock
### `receive_restock`
Booth Staff target Booth.
Update Booth stock + movements.

## 7a. Absensi 4 titik (BR-042)
Semua absen membawa `latitude`, `longitude`, `photo_url` (hasil `POST /shifts/attendance/photo`) dan ditolak
`OUTSIDE_ATTENDANCE_RADIUS` (details `{ distance, radius, point }`) di luar radius acuannya, kecuali ada izin Admin.
- Berangkat: `POST /shifts/check-in` (acuan Gudang) — error tambahan `PREVIOUS_SHIFT_NOT_RETURNED`. Response shift aktif
  memuat `arrivedAt` dan `cashFloat`.
- Tiba: `POST /shifts/:id/arrive` (acuan Booth, shift OPEN milik Barista, idempotent).
- Kembali: `POST /shifts/:id/return` (acuan Gudang, shift CLOSED milik Barista, idempotent).
- `GET /shifts/pending-return` (Barista): shift yang sudah Check-Out tapi belum Kembali, atau kosong.
- Izin: `POST /attendance-permits` (Admin: `staff_id`, `type` LOCATION|EARLY_CHECKOUT, `point` untuk LOCATION,
  `reason`), `GET /attendance-permits?date=YYYY-MM-DD` (Admin/Owner, default hari ini).
- Pengaturan: `PATCH /app-settings` menerima `warehouse_latitude/longitude` (null = kosongkan),
  `attendance_radius_meters` (20–1000), `early_checkout_tolerance_minutes` (0–180); booth menerima `cash_float`.

## 8. Start closing
### `start_shift_closing`
Returns server snapshot expected stock per product.
Shift status stays OPEN — staff can still transact normally until checkout
is confirmed. "Closing in progress" is tracked via ShiftStockCount.status
(DRAFT), not the shift status.

Start & confirm closing (Check-Out) juga ditolak `ARRIVAL_REQUIRED` (belum Tiba) dan `EARLY_CHECKOUT` (details
`allowedFrom`) sebelum jam selesai shift dikurangi toleransi; confirm memvalidasi lokasi terhadap Booth. Setoran
yang dibuat saat confirm = kas Tunai + uang jalan (BR-043). Approve Stok Kembali & Setor Uang shift CLOSED ditolak
`BARISTA_NOT_RETURNED` sebelum absen Kembali.

## 9. Confirm closing count
### `confirm_shift_closing`
Input:
```json
{
  "shift_session_id":"uuid",
  "idempotency_key":"uuid",
  "items":[
    {
      "product_id":"uuid",
      "actual_qty":4,
      "reason_code":"DAMAGED",
      "reason_note":null
    }
  ]
}
```
Server recomputes expected at transaction time / validates closing snapshot, stores count, handles adjustments, closes shift.

## 10. Submit return
### `submit_stock_return`
Default items can be generated server-side from closing actual balance. Client confirms.

## 11. Receive return
### `receive_stock_return`
Admin input actual received quantities.
Warehouse increment + movement, discrepancy if mismatch.

## 12. Stock adjustment
### `adjust_stock`
Admin only.
Input location, product, delta or target qty, reason.
Prefer API with target count then server derives delta to reduce confusion.

### `write_off_stock` (Pemusnahan Stok Gudang, BR-041)
Admin only. `POST /stock-adjustments/write-off` dengan `product_id`, `qty` (cup yang dibuang, >=1), `photo_url`
(wajib, hasil `POST /stock-adjustments/write-off/photo`, multipart field `file`, JPG/PNG/WEBP/GIF maks 5MB; URL di
luar `/uploads/stock-write-offs/` ditolak), `reason_note` opsional, `idempotency_key`. Hasilnya dokumen adjustment
Gudang beralasan `EXPIRED` + movement `ADJUSTMENT` keluar Gudang; dibatalkan lewat `POST /stock-adjustments/:id/reverse`.
Error: `INSUFFICIENT_STOCK` (details `{ available }`), `ADJUSTMENT_ALREADY_REVERSED` saat reverse kedua.

## 13. Void sale
### `void_sale`
Admin only, reason required, reversal movement generated.

## 14. Query pagination/filter
Semua list besar:
- cursor or limit/offset;
- period;
- Booth;
- status;
- product;
- search.

## 15. Error envelope
UI-facing service harus normalize error:
```json
{
  "code":"INSUFFICIENT_STOCK",
  "message":"Stok Matcha tidak cukup.",
  "details":{"available":2,"requested":3}
}
```

## 16. Concurrency
Gunakan row locking atau atomic SQL condition untuk stock balances. Optimistic `version` dapat dipakai sebagai tambahan.

## 17. Correction / Reconciliation RPC

Minimum domain operation:

### `preview_transaction_correction`
Admin-only untuk posted transaction. Return before/after/net impact dan flag dependency/reconciliation.

### `revise_sale`
Atomic reverse original sale + payment + stock movements, create replacement version, update projections/aggregates.

### `revise_payment`
Untuk correction metode pembayaran tanpa stock effect. `POST /sales/:id/revise-payment` dengan `method`
(CASH/QRIS, satu metode penuh) ATAU `payments` (Split, >=2 baris, jumlahnya pas = total), plus `reason_code`,
`reason_note`, `qris_proof_photo_url`. Semua baris payment POSTED di-supersede lalu diganti; `sales.payment_method`
ikut diperbarui. Role ADMIN dan BOOTH_STAFF (BR-040).

Error codes: `PAYMENT_UNCHANGED`, `PAYMENT_AMOUNT_MISMATCH`, `QRIS_PROOF_REQUIRED` (Barista, metode baru memuat
QRIS), `REASON_NOTE_REQUIRED` (Barista tanpa alasan), `SALE_NOT_IN_ACTIVE_SHIFT` (Barista, sale bukan dari shift
OPEN miliknya), `SALE_NOT_CORRECTABLE`.

### `cancel_distribution` / `revise_distribution`
Handle DRAFT/SENT/RECEIVED sesuai state dan downstream dependency.

### `correct_distribution_receipt`
Correction confirmed qty_received tanpa overwrite original receipt.

### `cancel_restock_request` / `revise_restock_request`
Tidak boleh menghapus shipment yang sudah posted.

### `revise_stock_return` / `correct_return_receipt`
Correction submitted/received return dengan delta/reconciliation.

### `create_stock_opname` / `revise_stock_opname`
Create physical count dan recount version; generate adjustment movement.

### `create_stock_adjustment` / `reverse_stock_adjustment`
Admin-only. Input target actual quantity lebih disarankan daripada client-calculated delta.

### `reconcile_transaction_chain`
Recalculate stock projection, shift summary, closing expected/discrepancy, return summary, sales/payment aggregates, owner KPI.

Seluruh correction RPC: authorization, idempotency, row locks/atomic validation, audit, dan no-negative-stock rule wajib.
