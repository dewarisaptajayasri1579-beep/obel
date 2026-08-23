# 22 — Mermaid Diagrams

## 1. End-to-end stock flow

```mermaid
flowchart LR
    W[Gudang Pusat] -->|Distribusi Awal| T1[Stok In Transit]
    T1 -->|Petugas Terima| B[Stok Booth]
    B -->|Penjualan| C[Customer]
    B -->|Stok Menipis| RQ[Request Restock]
    RQ -->|Admin Approve & Kirim| T2[Restock In Transit]
    T2 -->|Petugas Terima| B
    B -->|Closing & Physical Count| CL[Closing]
    CL -->|Return Sisa Fisik| RT[Return In Transit]
    RT -->|Admin Terima| W
```

## 2. Application context

```mermaid
flowchart TB
    BS[Flutter Android\nPetugas Booth]
    AW[Next.js PWA\nAdmin Pusat]
    OW[Flutter Android\nOwner]

    BS --> API[Backend API\nNode.js/NestJS]
    AW --> API
    OW --> API

    API --> AUTH[Auth - JWT custom]
    API --> SVC[Domain Services /\nUse-case Layer]
    SVC --> PG[(PostgreSQL\nself-hosted di Coolify)]
    API --> RT[Realtime - WebSocket/Socket.io]
    API --> ST[Storage - S3-compatible/MinIO]
```

## 3. Core entity relationship overview

```mermaid
erDiagram
    PROFILES ||--o{ SHIFT_SESSIONS : assigned
    BOOTHS ||--o{ SHIFT_SESSIONS : runs
    SHIFT_TEMPLATES ||--o{ SHIFT_SESSIONS : template
    PRODUCT_CATEGORIES ||--o{ PRODUCTS : contains
    BOOTHS ||--o{ BOOTH_STOCKS : owns
    PRODUCTS ||--o{ BOOTH_STOCKS : balance
    PRODUCTS ||--o| WAREHOUSE_STOCKS : balance
    BOOTHS ||--o{ STOCK_DISTRIBUTIONS : target
    STOCK_DISTRIBUTIONS ||--|{ STOCK_DISTRIBUTION_ITEMS : contains
    PRODUCTS ||--o{ STOCK_DISTRIBUTION_ITEMS : product
    SHIFT_SESSIONS ||--o{ SALES : contains
    SALES ||--|{ SALE_ITEMS : contains
    PRODUCTS ||--o{ SALE_ITEMS : product
    SALES ||--o{ PAYMENTS : paid_by
    SHIFT_SESSIONS ||--o{ RESTOCK_REQUESTS : requests
    RESTOCK_REQUESTS ||--|{ RESTOCK_REQUEST_ITEMS : contains
    SHIFT_SESSIONS ||--o| SHIFT_STOCK_COUNTS : closes_with
    SHIFT_STOCK_COUNTS ||--|{ SHIFT_STOCK_COUNT_ITEMS : contains
    SHIFT_SESSIONS ||--o{ STOCK_RETURNS : returns
    STOCK_RETURNS ||--|{ STOCK_RETURN_ITEMS : contains
    PRODUCTS ||--o{ STOCK_MOVEMENTS : ledger
```

## 4. Sale transaction sequence

```mermaid
sequenceDiagram
    participant P as Petugas App
    participant API as Backend API\ncreate_paid_sale
    participant DB as PostgreSQL
    participant PR as Printer

    P->>API: idempotency_key, shift, items, payment method
    API->>DB: validate role + OPEN shift
    API->>DB: lock/check Booth stock
    API->>DB: read current product prices
    API->>DB: insert sale + items + payment
    API->>DB: decrement Booth stock
    API->>DB: insert stock movements
    DB-->>API: commit
    API-->>P: sale_no + total + remaining stock
    P->>PR: print receipt
    alt Print failed
        PR-->>P: failed
        P-->>P: show Print Ulang
    end
```

## 5. Closing sequence

```mermaid
sequenceDiagram
    participant P as Petugas
    participant S as Server
    participant A as Admin

    P->>S: Start Closing
    S-->>P: Expected stock snapshot
    P->>P: Count actual physical stock
    P->>S: Confirm actual + discrepancy reasons
    S->>S: Save count + adjustment + close shift
    S-->>P: Return draft from actual stock
    P->>S: Submit Return
    S-->>A: Return pending
    A->>S: Receive actual physical return
    S->>S: Add warehouse stock + discrepancy if any
```

## Correction flow

```mermaid
flowchart TD
    A[Posted Transaction] --> B[Admin pilih Revisi/Batalkan]
    B --> C[Reason + Proposed Change]
    C --> D[Impact Preview]
    D --> E{Valid & no impossible stock?}
    E -- No --> F[Reconciliation Required]
    E -- Yes --> G[Reverse Original Effect]
    G --> H{Revision?}
    H -- Yes --> I[Post Replacement Version]
    H -- No --> J[Mark Reversed/Void]
    I --> K[Recalculate Projection & Aggregates]
    J --> K
    K --> L[Audit + Commit]
```

## Stock opname correction

```mermaid
flowchart LR
    A[Expected Snapshot] --> B[Physical Count V1]
    B --> C[Adjustment V1]
    C --> D{Input salah?}
    D -- Yes --> E[Recount V2]
    E --> F[Compensating Adjustment]
    F --> G[Latest Effective Count]
    D -- No --> G
```
