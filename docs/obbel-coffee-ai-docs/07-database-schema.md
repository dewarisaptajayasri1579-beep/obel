# 07 — Database Schema

Target: PostgreSQL self-hosted di Coolify, diakses melalui Backend API custom (bukan langsung dari client).

## 1. Enum konseptual

```text
user_role: BOOTH_STAFF | ADMIN | OWNER
booth_status: ACTIVE | INACTIVE
shift_status: SCHEDULED | OPEN | CLOSING | CLOSED | CANCELLED
distribution_status: DRAFT | SENT | RECEIVED | DISCREPANCY | CANCELLED
restock_status: REQUESTED | APPROVED | REJECTED | PREPARED | SENT | RECEIVED | DISCREPANCY | CANCELLED
return_status: DRAFT | SUBMITTED | RECEIVED | DISCREPANCY | CANCELLED
sale_status: PENDING | PAID | VOIDED
payment_method: CASH | QRIS
stock_movement_type: OPENING | WAREHOUSE_TO_BOOTH | SALE | RESTOCK | RETURN_TO_WAREHOUSE | ADJUSTMENT | VOID_REVERSAL
stock_location_type: WAREHOUSE | BOOTH | IN_TRANSIT
```

## 2. `profiles`
Extends `auth.users`.

| Field | Type | Rule |
|---|---|---|
| id | uuid PK/FK auth.users | required |
| full_name | text | required |
| role | user_role | required |
| default_booth_id | uuid nullable | optional |
| active | boolean | default true |
| created_at | timestamptz | default now |
| updated_at | timestamptz | |

Index: role, default_booth_id.

## 3. `booths`
| Field | Type |
|---|---|
| id uuid PK |
| code text unique |
| name text |
| location_name text |
| address text nullable |
| latitude numeric nullable |
| longitude numeric nullable |
| status booth_status |
| created_at timestamptz |
| updated_at timestamptz |

## 4. `product_categories`
- id uuid PK
- code text unique
- name text
- sort_order int
- active bool

## 5. `products`
- id uuid PK
- sku text unique
- name text
- category_id uuid FK
- sell_price bigint CHECK >= 0
- image_url text nullable
- active bool
- sort_order int
- created_at, updated_at

Harga pada `sale_items` tetap disnapshot agar perubahan price master tidak mengubah histori.

## 6. `shift_templates`
- id uuid PK
- name text
- start_time time
- end_time time
- active bool

Jam shift configurable, tidak hardcode.

## 7. `shift_sessions`
Instance aktual per Booth.

- id uuid PK
- business_date date
- booth_id uuid FK
- shift_template_id uuid FK
- staff_id uuid FK profiles
- status shift_status
- scheduled_start_at timestamptz
- scheduled_end_at timestamptz
- opened_at timestamptz nullable
- closing_started_at timestamptz nullable
- closed_at timestamptz nullable
- opening_note text nullable
- closing_note text nullable
- created_by uuid
- created_at, updated_at

Constraint: cegah satu Booth memiliki dua session OPEN yang overlap kecuali business rule sengaja mengizinkan.

## 8. `warehouse_stocks`
Snapshot balance.

- product_id uuid PK/FK
- qty_on_hand int CHECK >= 0
- qty_reserved int CHECK >= 0 default 0
- updated_at
- version bigint default 0

Derived available:
`qty_available = qty_on_hand - qty_reserved`

## 9. `booth_stocks`
- booth_id uuid FK
- product_id uuid FK
- qty_on_hand int CHECK >= 0
- updated_at
- version bigint default 0
- PRIMARY KEY (booth_id, product_id)

## 10. `booth_stock_thresholds`
- booth_id uuid FK
- product_id uuid FK
- minimum_qty int >= 0
- critical_qty int >= 0
- PRIMARY KEY (booth_id, product_id)

Rule recommended: critical_qty <= minimum_qty.

## 11. `stock_distributions`
Initial or manual distribution warehouse → Booth.

- id uuid PK
- distribution_no text unique
- booth_id uuid FK
- shift_session_id uuid nullable FK
- status distribution_status
- sent_at timestamptz nullable
- received_at timestamptz nullable
- created_by uuid
- received_by uuid nullable
- note text nullable
- idempotency_key uuid unique
- created_at, updated_at

## 12. `stock_distribution_items`
- id uuid PK
- distribution_id uuid FK cascade
- product_id uuid FK
- qty_sent int > 0
- qty_received int nullable >= 0
- discrepancy_qty int generated/derived or stored
- UNIQUE(distribution_id, product_id)

## 13. `restock_requests`
- id uuid PK
- request_no text unique
- booth_id uuid FK
- shift_session_id uuid FK
- requested_by uuid
- status restock_status
- priority text/enum NORMAL|URGENT optional
- requested_at timestamptz
- approved_by uuid nullable
- approved_at timestamptz nullable
- sent_at timestamptz nullable
- received_at timestamptz nullable
- reject_reason text nullable
- note text nullable
- idempotency_key uuid unique

## 14. `restock_request_items`
- id uuid PK
- restock_request_id uuid FK
- product_id uuid FK
- stock_at_request int >= 0
- qty_requested int > 0
- qty_approved int nullable >= 0
- qty_sent int nullable >= 0
- qty_received int nullable >= 0
- UNIQUE(request, product)

## 15. `sales`
- id uuid PK
- sale_no text unique
- idempotency_key uuid unique
- booth_id uuid FK
- shift_session_id uuid FK
- staff_id uuid FK
- status sale_status
- subtotal bigint >= 0
- discount bigint >= 0 default 0
- total bigint >= 0
- payment_method payment_method
- paid_at timestamptz nullable
- voided_at timestamptz nullable
- void_reason text nullable
- created_at

V1 discount dapat selalu 0 tetapi field boleh tersedia.

## 16. `sale_items`
- id uuid PK
- sale_id uuid FK
- product_id uuid FK
- product_name_snapshot text
- unit_price bigint >= 0
- qty int > 0
- line_total bigint >= 0

Server menghitung line_total, subtotal, total.

## 17. `payments`
V1 satu payment per sale, tetapi tabel terpisah membuat future-proof.

- id uuid PK
- sale_id uuid FK
- method payment_method
- amount bigint >= 0
- reference_no text nullable
- paid_at timestamptz

Constraint V1: total payment = sale.total.

## 18. `shift_stock_counts`
Header physical count saat closing.

- id uuid PK
- shift_session_id uuid unique FK
- counted_by uuid
- counted_at timestamptz
- status text `DRAFT|CONFIRMED`
- note text nullable

## 19. `shift_stock_count_items`
- id uuid PK
- stock_count_id uuid FK
- product_id uuid FK
- expected_qty int >= 0
- actual_qty int >= 0
- discrepancy_qty int
- reason_code text nullable
- reason_note text nullable
- UNIQUE(stock_count_id, product_id)

`discrepancy_qty = actual_qty - expected_qty`.

## 20. `stock_returns`
- id uuid PK
- return_no text unique
- booth_id uuid FK
- shift_session_id uuid FK
- status return_status
- submitted_by uuid
- submitted_at timestamptz nullable
- received_by uuid nullable
- received_at timestamptz nullable
- note text nullable
- idempotency_key uuid unique

## 21. `stock_return_items`
- id uuid PK
- stock_return_id uuid FK
- product_id uuid FK
- qty_submitted int >= 0
- qty_received int nullable >= 0
- discrepancy_qty int nullable
- reason_code text nullable
- UNIQUE(return, product)

## 22. `stock_movements`
Immutable ledger.

- id uuid PK
- movement_no text unique
- movement_type stock_movement_type
- product_id uuid FK
- qty int > 0
- from_location_type stock_location_type nullable
- from_warehouse_id / from_booth_id nullable sesuai desain
- to_location_type stock_location_type nullable
- to_booth_id nullable
- reference_type text
- reference_id uuid
- shift_session_id uuid nullable
- business_date date
- occurred_at timestamptz
- created_by uuid
- reason_code text nullable
- note text nullable

Recommended indexes:
- (product_id, occurred_at)
- (reference_type, reference_id)
- (shift_session_id, occurred_at)
- (business_date, movement_type)
- booth reference fields.

Ledger **tidak boleh di-update/delete** setelah posted. Koreksi menggunakan movement baru `ADJUSTMENT` atau `VOID_REVERSAL`.

## 23. `audit_logs`
- id uuid PK
- actor_id uuid
- action text
- entity_type text
- entity_id uuid nullable
- before_data jsonb nullable
- after_data jsonb nullable
- metadata jsonb nullable
- created_at timestamptz

## 24. Reporting views
Buat view/materialized view bila dibutuhkan:
- `v_daily_sales_by_booth`
- `v_daily_sales_by_product`
- `v_booth_stock_status`
- `v_shift_summary`
- `v_discrepancy_summary`
- `v_owner_daily_kpi`

Materialized view hanya bila performa perlu; jangan optimasi prematur.

## 25. Referential delete rules
Master yang sudah dipakai transaksi jangan hard delete. Gunakan `active=false`.

Transactional records jangan cascade-delete secara bebas.

## 26. Data consistency / correction additions

Semua transaction material harus memiliki lineage/version semantic. Nama kolom dapat disesuaikan, tetapi minimum konsep:

```text
transaction_group_id uuid
version_no int default 1
revision_of_id uuid nullable
superseded_by_id uuid nullable
reversal_of_id uuid nullable
posting_status DRAFT|POSTED|REVERSED
business_date date
posted_at timestamptz nullable
reversed_at timestamptz nullable
correction_reason_code text nullable
correction_reason_note text nullable
row_version bigint default 0
```

Untuk tabel yang sudah mempunyai status lifecycle khusus, `posting_status` boleh derived selama perbedaan DRAFT/POSTED/REVERSED tidak ambigu.

### `transaction_corrections`
- id uuid PK
- entity_type text
- entity_id uuid
- transaction_group_id uuid
- correction_type `VOID|REVISION|RECOUNT|ADJUSTMENT|PAYMENT_CORRECTION`
- original_version_id uuid nullable
- replacement_version_id uuid nullable
- reason_code text required
- reason_note text nullable
- impact_snapshot jsonb
- status `PENDING|POSTED|FAILED`
- created_by uuid
- created_at timestamptz
- posted_at timestamptz nullable
- idempotency_key uuid unique

### `stock_opnames`
- id uuid PK
- opname_no text unique
- location_type `WAREHOUSE|BOOTH`
- booth_id uuid nullable
- business_date date
- status `DRAFT|CONFIRMED|SUPERSEDED`
- transaction_group_id uuid
- version_no int
- revision_of_id uuid nullable
- snapshot_at timestamptz
- confirmed_at timestamptz nullable
- counted_by uuid
- correction_reason_code text nullable
- note text nullable

### `stock_opname_items`
- id uuid PK
- stock_opname_id uuid FK
- product_id uuid FK
- expected_qty int
- actual_qty int
- discrepancy_qty int
- adjustment_movement_id uuid nullable
- reason_code text nullable
- reason_note text nullable
- UNIQUE(stock_opname_id, product_id)

### `reconciliation_cases`
- id uuid PK
- case_no text unique
- source_entity_type text
- source_entity_id uuid
- status `OPEN|RESOLVED|IGNORED`
- severity `INFO|WARNING|CRITICAL`
- reason_code text
- details jsonb
- resolved_by uuid nullable
- resolved_at timestamptz nullable
- resolution_note text nullable
- created_at timestamptz

### Payment lineage
`payments` minimum ditambah:
- status `POSTED|REVERSED|SUPERSEDED`;
- transaction_group_id uuid;
- version_no int;
- revision_of_id uuid nullable;
- reversal_of_id uuid nullable.

### Ledger constraints
Posted `stock_movements` tidak boleh update/delete oleh application role. Gunakan Postgres trigger (mis. `BEFORE UPDATE/DELETE` yang menolak) dan pembatasan privilege DB user milik backend, bukan hanya convention aplikasi.

## 27. Optional/Future `sales_returns`
Jika customer refund/return diaktifkan, gunakan dokumen terpisah dari sale void:
- `sales_returns`: id, return_no, sale_id, status, refund_total, payment_method/refund_method, stock_return_policy, reason, business_date, posted_at, created_by, lineage/audit fields.
- `sales_return_items`: sales_return_id, sale_item_id/product_id, qty, refund_amount, return_to_stock bool.

Original `sales` tetap PAID secara historis; net sales report mengurangi posted refund. Fitur ini boleh P1 bila operasional tidak membutuhkannya, tetapi semantic wajib tidak dicampur dengan VOID.
