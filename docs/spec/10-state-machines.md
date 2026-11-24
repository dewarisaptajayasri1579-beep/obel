# 10 — State Machines

## 1. Shift
```text
SCHEDULED
  ↓ open = absen Berangkat di Gudang
OPEN
  · absen Tiba di Booth (arrived_at; wajib sebelum Check-Out)
  ↓ start closing (snapshot stok utk hitung fisik; status TETAP OPEN)
  ↓ confirm checkout = absen Check-Out di Booth (lokasi + foto + jam selesai + rekap stok/uang)
CLOSED
  · absen Kembali di Gudang (returned_at) → approve Stok Kembali & Setor Uang terbuka,
    Barista boleh Berangkat lagi
```
Absen di tiap titik divalidasi radius & izin Admin (BR-042); status tidak bertambah — Tiba dan Kembali adalah
penanda waktu di ShiftSession, bukan status.
Alternative terminal: CANCELLED sebelum OPEN.

Shift tetap OPEN sepanjang proses closing berlangsung (petugas masih boleh
transaksi normal) — baru berpindah langsung ke CLOSED begitu checkout
dikonfirmasi sukses. "Sedang proses closing" ditandai oleh
`ShiftStockCount.status = DRAFT`, bukan status ShiftSession.

Invalid:
- CLOSED → OPEN tanpa audited admin reversal.

## 2. Distribution
```text
DRAFT → SENT → RECEIVED
             ↘ DISCREPANCY
DRAFT/SENT → CANCELLED (dengan stock reversal bila sudah deducted)
```

## 3. Restock
```text
REQUESTED
 ├→ REJECTED
 └→ APPROVED → PREPARED → SENT → RECEIVED
                              ↘ DISCREPANCY
```
PREPARED opsional dalam UI tetapi status disarankan untuk Gudang.

## 4. Return
```text
DRAFT → SUBMITTED → RECEIVED
                 ↘ DISCREPANCY
```

## 5. Sale
```text
PENDING → PAID → VOIDED
```
MVP dapat langsung create sebagai PAID dalam transaction yang sama; PENDING internal hanya jika diperlukan.

## 6. Printer job (client-side)
```text
NOT_REQUESTED → QUEUED → PRINTED
                     ↘ FAILED → RETRY
```
Status printer tidak boleh menentukan status sale. Sale sukses ditentukan server.

## 7. UI status mapping
Gunakan label Bahasa Indonesia:
- REQUESTED = Menunggu
- APPROVED = Disetujui
- PREPARED = Disiapkan
- SENT = Dikirim
- RECEIVED = Diterima
- DISCREPANCY = Ada Selisih
- REJECTED = Ditolak
- CLOSED = Selesai

## 8. Generic revision lifecycle

```text
DRAFT → POSTED
          ├→ REVERSED/VOIDED
          └→ SUPERSEDED_BY_REVISION
                     ↓
               Replacement V2 POSTED
```

Posted data tidak kembali menjadi editable draft.

## 9. Stock opname

```text
DRAFT → CONFIRMED
           └→ SUPERSEDED (jika recount)
                    ↓
             Recount V2 CONFIRMED
```

## 10. Reconciliation case

```text
OPEN → RESOLVED
  └→ IGNORED (Admin + reason, hanya jika business rule mengizinkan)
```
