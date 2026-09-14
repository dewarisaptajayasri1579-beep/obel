# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Obbel Coffee & Milk — stock, sales, and booth-monitoring platform for a mobile coffee-cart operation. One backend + one PostgreSQL database serve three clients:

- `apps/booth_flutter` — Flutter Android app for booth staff (POS, stock receipt, restock request, shift closing).
- `apps/admin_web` — Next.js (App Router) + TypeScript + Tailwind PWA for central admin/warehouse (distribution, restock, returns, monitoring, reports).
- `apps/owner_flutter` — Flutter Android app, read-only executive monitoring.
- `backend` — NestJS + Prisma + PostgreSQL API that all three clients consume. This is the single source of truth for stock, permissions, and pricing; no client is allowed to mutate stock directly.
- `packages/domain_contracts` — placeholder for shared domain/schema contracts (currently empty).
- `docs/obbel-coffee-ai-docs/` — the full functional/technical spec, numbered 00–25. Read the relevant numbered doc before implementing a feature in that area; `AGENTS.md` at the repo root is the condensed must-read summary.

## Commands

### Backend (`backend/`)
- `npm run start:dev` — run API with ts-node-dev (hot reload).
- `npm run build` / `npm run start` — compile to `dist` and run.
- `npm run prisma:generate` — regenerate Prisma client after schema changes.
- `npm run prisma:migrate` — create/apply a dev migration (`prisma migrate dev`).
- `npm run prisma:deploy` — apply migrations in a deployed environment.
- `npm run prisma:seed` — run `prisma/seed.ts`.
- `npm test` — unit tests (`jest --config jest.config.json`).
- `npm run test:e2e` — e2e tests (`jest --config test/jest-e2e.json --runInBand`); run a single e2e file with `npm run test:e2e -- test/correction-flows.e2e-spec.ts`.
- Requires `DATABASE_URL`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `PORT` (see `.env.example`); default `PORT=4000`.

### Admin web (`apps/admin_web/`)
- `npm run dev` — Next.js dev server.
- `npm run build` / `npm run start` — production build/run.
- `npm run lint` — ESLint.
- Requires `NEXT_PUBLIC_API_URL` pointing at the backend (see `.env.example`).

### Flutter apps (`apps/booth_flutter/`, `apps/owner_flutter/`)
- `flutter pub get`, `flutter run`, `flutter test`, `flutter analyze` — standard Flutter workflow, run from within each app directory.

## Architecture

### Non-negotiable domain rules (see `AGENTS.md` and `docs/obbel-coffee-ai-docs/24-data-consistency-correction-reversal.md` before touching any mutation)
- **Data consistency is P0.** Posted transactions are never hard-deleted or directly edited. Every mutable transaction type has an explicit correction/reversal/revision path (e.g. `reviseSale()`, `voidSale()`, `correctDistributionReceipt()`, `confirmStockOpname()`, `reverseAdjustment()`) — do not add generic CRUD update/delete for posted transactions.
- Stock only changes through backend domain services that write an append-only `StockMovement` row inside a DB transaction. `WarehouseStock`/`BoothStock` rows are projections that must stay reconcilable from the ledger — never `UPDATE` a stock quantity directly from a client or controller.
- Money is stored as integer Rupiah (no floats). Cup quantities are integer. Timestamps are stored UTC (`timestamptz`) and rendered in `Asia/Jakarta` in UI.
- Nothing is hardcoded: booth list, shift times, products, prices, stock thresholds, and users all come from master/config data.
- Authorization (role + booth scoping) is enforced in the backend service/application layer, not in the database (no RLS) and not trusted from client-supplied `role`/`booth_id`/totals.
- Roles: Petugas Booth is restricted to their assigned booth/shift; Admin Pusat can act across booths; Owner is strictly read-only.
- Idempotency keys and UUIDs are required for critical transactions (sales, distributions, restock, returns, adjustments) to prevent duplicate posting on double-tap/retry.

### Backend structure (`backend/src`)
- `modules/` — one folder per domain area, each typically with its own `dto/`: `auth`, `booths`, `products`, `catalog`, `booth-stock`, `booth-stock-thresholds`, `warehouse-stock`, `distributions`, `restock-requests`, `returns`, `sales`, `shifts`, `shift-templates`, `stock-adjustments`, `stock-opname`, `reconciliation-cases`, `corrections`, `dashboard`, `reports`, `owner`, `notifications`, `users`.
- `prisma/schema.prisma` defines the full relational model (Booth, Product, ShiftSession, BoothStock/WarehouseStock, Sale/SaleItem/Payment/SaleRefund, StockMovement, StockDistribution, RestockRequest, ShiftStockCount, StockReturn, TransactionCorrection, ReconciliationCase, StockOpname, ...). Any schema change goes through a Prisma migration, never a manual production schema edit.
- Correction/reversal mutation flow (see `02-system-architecture.md` §"Correction & Reconciliation Domain"): authorize → validate current state → impact preview/dependency check → reverse original effect → post replacement/correction → update stock & payment projections → recalculate aggregates/reconciliation → write audit log → commit atomically. This logic lives only in backend domain services, never duplicated in clients.
- Transaction boundaries that must be a single DB transaction: receiving a distribution, creating a sale (with stock deduction), receiving a restock, receiving a return, stock adjustment, and shift closing when it produces a discrepancy record.

### Client architecture
- Both Flutter apps and the admin web follow a repository-abstraction pattern: UI/screens never call the backend or manipulate stock directly, they go through a repository/service layer (e.g. `SalesRepository.createSale(...)`, `StockRepository.receiveDistribution(...)`). Critical stock mutations are always server-side calls, not local state edits.
- Flutter layering: Presentation/Screens → State Management → Use Cases/Application Services → Repository Interfaces → Backend API Repository (HTTP) → local cache/printer adapter. `booth_flutter` additionally has a Bluetooth thermal receipt printer adapter under `lib/printing/`.
- `owner_flutter` mirrors the same architecture but repositories are read/export-only (no mutation endpoints).
- `admin_web` uses Next.js App Router; conventional layout is `app/ (routes)`, `components/`, `features/`, `services`/`repositories`, `lib/api-client`, `schemas`.
- Domain naming must stay consistent by name across TypeScript and Dart even though there's no shared source (Flutter and the backend don't share code — `packages/domain_contracts` is the intended place for shared schema/contract docs).

### Formatting conventions used across clients
- Rupiah: `Rp24.560.000`. Quantity: `10 cup`. Date/time: `23 Agu 2026, 15.40` (Asia/Jakarta).
- Code/domain identifiers are English (`RestockRequest`); UI copy is Bahasa Indonesia.

## Where to look for feature specs

`docs/obbel-coffee-ai-docs/` is numbered by concern — check the relevant one before implementing:
`03` roles/permissions, `05` feature spec, `07` database schema, `08` business rules, `09` API/RPC contract, `10` state machines, `12` reporting/dashboard KPIs, `13` security/audit, `24` correction/reversal rules (read before any mutation work), `25` per-transaction cancel/revise impact matrix.
