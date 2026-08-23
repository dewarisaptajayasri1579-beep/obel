# 14 — Development Guideline

## 1. Repository recommendation
Monorepo boleh digunakan:

```text
obbel-platform/
  apps/
    booth_flutter/
    admin_web/
    owner_flutter/
  backend/
    src/
      modules/        # per domain: stock, sale, restock, shift, auth, dst.
      migrations/
      seed/
  packages/
    domain_contracts/   # docs/json schema if useful
  docs/
```

Flutter tidak berbagi source langsung dengan TypeScript, tetapi domain naming harus sama.

## 2. Flutter folder
```text
lib/
  app/
  core/
    theme/
    routing/
    network/
    errors/
  features/
    auth/
    home/
    pos/
    stock/
    restock/
    shift/
    reports/
  shared/
    widgets/
    models/
  data/
    repositories/
    services/
```

## 3. Admin Web folder
```text
src/
  app/
  components/
  features/
  lib/
  services/
  repositories/
  types/
  schemas/
```

## 4. Naming
Gunakan English untuk code/domain identifiers, Bahasa Indonesia untuk UI copy.

Contoh:
- `RestockRequest`
- label: “Permintaan Restock”

## 5. Type safety
- TypeScript strict.
- Flutter null safety.
- Generated API client types (mis. dari OpenAPI spec/tRPC/Prisma) bila memungkinkan.
- Validation schema pada boundary.

## 6. Repository abstraction
UI tidak memanggil database/Backend API langsung di widget/component.

Contoh:
```text
SalesRepository.createSale(...)
StockRepository.receiveDistribution(...)
```

## 7. Error model
Normalize domain errors ke stable codes. UI mapping ke Bahasa Indonesia.

## 8. Design tokens
Centralize:
- colors;
- spacing;
- radius;
- typography;
- shadows.

## 9. Reusable components
Flutter:
- KpiCard
- ProductCard
- QuantityStepper
- PeriodSelector
- StatusBadge
- PrimaryActionButton
- BoothAlertCard

Web:
- KpiCard
- BoothCard
- StatusBadge
- QuickQty
- DataTable
- FilterChips
- DetailDrawer

## 10. No hardcoded business logic in widgets
Threshold, totals, permission, status transition berasal dari domain/service/server.

## 11. Formatting
Rupiah:
`Rp24.560.000`

Qty:
`10 cup`

Date/time local:
`23 Agu 2026, 15.40`

## 12. Testing pyramid
- unit domain math;
- repository/service integration;
- widget/component tests;
- E2E critical flows.

## 13. Commit discipline
Implement per vertical slice. Contoh:
`feat(stock): receive distribution atomically`

## 14. Migration discipline
Semua DB perubahan lewat migration file versioned. Jangan edit production schema manual tanpa migration.

## 15. Mock data
Mock repository boleh digunakan sebelum backend siap. Setelah backend terhubung, jangan meninggalkan conditional mock tersembunyi di production.

## Coding rule — correction

Dilarang membuat generic CRUD `update/delete` untuk posted transactions.

Gunakan explicit domain methods, misalnya:
- `reviseSale()`;
- `voidSale()`;
- `correctDistributionReceipt()`;
- `confirmStockOpname()`;
- `reverseAdjustment()`.

Setiap method harus mempunyai transaction boundary tunggal untuk reversal + replacement + projection + audit.

Tambahkan automated invariant check untuk memastikan saldo snapshot dapat direconcile dengan ledger.
