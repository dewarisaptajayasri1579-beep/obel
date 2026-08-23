# 10 — State Machines

## 1. Shift
```text
SCHEDULED
  ↓ open
OPEN
  ↓ start closing
CLOSING
  ↓ confirm count
CLOSED
```
Alternative terminal: CANCELLED sebelum OPEN.

Invalid:
- CLOSED → OPEN tanpa audited admin reversal.
- CLOSING → sale normal.

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
