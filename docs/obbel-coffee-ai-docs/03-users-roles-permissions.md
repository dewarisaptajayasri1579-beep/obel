# 03 — Users, Roles & Permissions

## 1. Role
Gunakan enum konseptual:
- `BOOTH_STAFF`
- `ADMIN`
- `OWNER`

Jika nanti ada role Runner/Kurir, tambahkan sebagai fase berikutnya; jangan implementasikan sekarang.

## 2. BOOTH_STAFF
### Boleh
- login;
- melihat profil sendiri;
- melihat Booth dan shift assignment aktif;
- melihat master produk aktif dan harga;
- melihat stock Booth sendiri;
- menerima distribusi yang ditujukan ke Booth/shift sendiri;
- membuat sale untuk Booth/shift sendiri;
- melihat/print ulang transaksi shift sendiri;
- membuat restock request;
- menerima restock untuk Booth sendiri;
- memulai/tutup shift sesuai rule;
- menginput actual count pada closing;
- membuat return setelah closing;
- melihat ringkasan shift sendiri.

### Tidak boleh
- melihat data Booth lain;
- mengubah harga;
- mengubah master produk;
- menambah stok langsung;
- approve restock sendiri;
- menerima return ke Gudang;
- koreksi movement ledger;
- melihat dashboard Owner global.

## 3. ADMIN
### Boleh
- semua data operasional lintas Booth;
- manage product, Booth, shift template, user assignment;
- melihat dan mengatur warehouse stock melalui movement resmi;
- membuat distribusi;
- approve/reject restock;
- mengirim restock;
- menerima return;
- melakukan adjustment dengan alasan wajib;
- melihat sale dan laporan;
- export laporan.

### Tidak boleh
- menghapus stock movement yang sudah posted;
- mengubah transaksi paid secara sembarang tanpa void/reversal flow;
- bypass audit log.

## 4. OWNER
### Boleh
- membaca KPI global;
- ranking Booth;
- detail Booth;
- sales analytics;
- stock condition;
- discrepancy;
- laporan dan export read-only.

### Tidak boleh
- create/update/delete data operasional;
- distribusi;
- restock approval;
- return acceptance;
- adjustment;
- mengedit user/master.

## 5. Matriks permission

| Aksi | Booth Staff | Admin | Owner |
|---|:---:|:---:|:---:|
| View produk aktif | ✓ | ✓ | ✓ |
| Create sale | ✓ own booth | ✓ optional | ✗ |
| Receive initial stock | ✓ own booth | ✓ override audited | ✗ |
| Request restock | ✓ own booth | ✓ | ✗ |
| Approve restock | ✗ | ✓ | ✗ |
| Receive restock | ✓ own booth | ✓ override | ✗ |
| Close shift | ✓ assigned | ✓ override | ✗ |
| Return stock | ✓ submit | ✓ receive | ✗ |
| Stock adjustment | ✗ | ✓ | ✗ |
| Edit master | ✗ | ✓ | ✗ |
| Global report | ✗ | ✓ | ✓ read-only |
| View discrepancy | own shift | ✓ | ✓ |

## 6. Assignment rules
`profiles.booth_id` boleh dipakai sebagai default Booth untuk user tetap, tetapi assignment aktual harus diambil dari `shift_sessions.staff_id` + `booth_id` agar mendukung perpindahan petugas.

## 7. RLS intent
Policy minimal:
- Booth Staff: rows scoped by booth yang ditugaskan/shift aktif.
- Admin: operational CRUD sesuai tabel.
- Owner: SELECT only pada view/table reporting yang diizinkan.

Jangan mengandalkan hidden button sebagai security.

## Permission koreksi data

### BOOTH_STAFF
Hanya dapat mengubah data sebelum confirmation/posting sesuai lifecycle: cart, qty penerimaan sebelum receive, restock request REQUESTED, closing count DRAFT, return DRAFT. Tidak dapat void/revise transaksi posted.

### ADMIN
Mempunyai permission correction posted transaction melalui flow terkontrol: reason wajib, impact preview, reversal/replacement, dan audit. Admin juga menjalankan stock opname, recount, dan reconciliation.

### OWNER
Read-only terhadap correction. Owner dapat melihat nilai effective terbaru dan audit/indikator data direvisi, tetapi tidak dapat melakukan mutation.
