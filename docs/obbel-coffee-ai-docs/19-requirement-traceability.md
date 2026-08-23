# 19 — Requirement Traceability Matrix

| Req | Kebutuhan | App | Data/Service | Test |
|---|---|---|---|---|
| R01 | Petugas menerima stok pagi | Booth | distribution, receive_distribution | AC-03/04 |
| R02 | Admin input/alokasi stok ke Booth | Admin | distribution | E2E-1 |
| R03 | Pembeli mendapat nota | Booth | sale, payment, printer | AC-21 |
| R04 | Penjualan mengurangi stok | Booth | create_paid_sale, stock movement | AC-05/06/07 |
| R05 | Pusat melihat sisa stok | Admin | booth_stocks/view | AC-09 |
| R06 | Warning stok hampir habis | Booth/Admin/Owner | threshold view | AC-09 |
| R07 | Pusat mengirim restock | Admin | restock RPC | AC-10/11/12 |
| R08 | Dashboard pusat | Admin | aggregate query | UI/E2E |
| R09 | Minimum per Booth per produk | Admin | thresholds | AC-09 |
| R10 | Ringkasan penjualan shift | Booth/Admin/Owner | shift summary view | report test |
| R11 | Sisa stok kembali Gudang | Booth/Admin | stock return | AC-16/17 |
| R12 | Shift berikutnya mendapat alokasi baru | Admin/Booth | shift session + distribution | E2E |
| R13 | Web + Android | All | architecture | build test |
| R14 | Simple, font fokus | All | design system | visual QA |
| R15 | Banyak klik, minim ketik | All | UX components | usability QA |
| R16 | Owner monitoring | Owner | read-only reporting | AC-18 |
| R17 | Selisih stok | All | closing counts/discrepancy | AC-13/14 |
| R18 | Satu backend/database | All | Backend API (Node.js/NestJS) + PostgreSQL di Coolify | architecture review |

## Coverage rule
Setiap fitur baru harus:
1. diberi requirement ID baru;
2. dipetakan ke screen/service/table;
3. memiliki acceptance criteria.

## Data consistency traceability

| Requirement | Feature/Rule | Data/API | Test |
|---|---|---|---|
| Batalkan sale | Void/Reversal | sale/payment/stock movement correction | AC-26 |
| Revisi sale | Reverse + replacement | revise_sale | AC-27 |
| Revisi payment | Payment correction | revise_payment | AC-28 |
| Cancel/revisi distribusi | Distribution correction | cancel/revise_distribution | AC-29/30 |
| Correction setelah closing | Reconciliation | reconcile_transaction_chain | AC-31 |
| Stok opname | Physical count + adjustment | stock_opnames | AC-40 |
| Recount | Versioned opname | revise_stock_opname | AC-32 |
| Koreksi return | Return correction | correct_return_receipt | AC-33 |
| Koreksi adjustment | Reversal movement | reverse_stock_adjustment | AC-34 |
| Anti negative stock | Impact validation | correction preview/reconcile | AC-35 |
| Ledger = projection | Integrity rebuild | stock_movements | AC-38 |
