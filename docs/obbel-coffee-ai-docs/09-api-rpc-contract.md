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
- `PRODUCT_INACTIVE`
- `INSUFFICIENT_STOCK`
- `INVALID_QTY`

## 4. Create restock request
### `create_restock_request`
Input booth derived from shift, product + qty.

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

## 8. Start closing
### `start_shift_closing`
Returns server snapshot expected stock per product.
Sets shift to CLOSING.

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
Untuk correction metode pembayaran tanpa stock effect.

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
