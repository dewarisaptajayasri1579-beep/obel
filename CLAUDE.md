# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Obbel Coffee & Milk — stock, sales, and booth-monitoring platform for a mobile coffee-cart operation. One backend + one PostgreSQL database serve every client:

- `apps/admin_web` — Next.js (App Router) + TypeScript + Tailwind. The Admin/Owner console (distribution, stock, monitoring, reports; Owner is read-only) and, under `src/app/petugas`, the Barista PWA (POS, check-in/out, stock receipt, shift closing).
- `apps/booth_pwa_flutter` — Android shell that wraps the Barista PWA in a WebView and bridges GPS, Bluetooth receipt printing and the camera (see its README). No business logic.
- `backend` — NestJS + Prisma + PostgreSQL API. The single source of truth for stock, permissions, and pricing; no client is allowed to mutate stock directly. Coolify builds it from `/backend`, so it stays at the root.
- `docs/spec/` — the original functional/technical spec, numbered 00–26. Read the relevant numbered doc before implementing a feature in that area; `AGENTS.md` at the repo root is the condensed must-read summary. The spec still describes the first native Flutter apps (`booth_flutter`, `owner_flutter`); both were replaced by the PWA and removed.
- `docs/stock-v2/` — the stock-recording redesign (ledger, monthly balance, shift-held stock) that the current stock code follows; `docs/assets/` (logo, mockups), `docs/notes/`.
- `scripts/` — root dev tooling (`dev.js`, `check-ports.js`).

## Commands

### Root (`/`)
- `npm run dev` — starts the backend (4000) and the admin web (3000) together in one terminal through `scripts/dev.js` (no dependencies): if one stops, the other stops too, and one Ctrl+C stops both without cmd.exe's "Terminate batch job (Y/N)?" prompts. Run it from the root, not from the app folders.
- `predev` (`scripts/check-ports.js`) refuses to start while 3000 or 4000 is already taken, usually a leftover `npm run dev`.
- `.npmrc` sets `script-shell` to `cmd.exe` on purpose: with Git Bash as npm's script shell, Ctrl+C only stops npm and leaves orphaned servers holding the ports. Don't remove it without re-testing Ctrl+C.

### Backend (`backend/`)
- `npm run start:dev` — run API with ts-node-dev (hot reload).
- `npm run build` / `npm run start` — compile to `dist` and run.
- `npm run prisma:generate` — regenerate Prisma client after schema changes.
- `npm run prisma:migrate` — `prisma migrate dev`. **Local database only.** `obbel-db` on Coolify is production (client data): never point a local `.env` at it, and never run `migrate dev` there (it may ask to reset on drift). Migrations reach production only through `prisma migrate deploy`, which the backend Dockerfile runs on every Coolify deploy.
- `npm run prisma:deploy` — apply pending migrations (use it for `obbel_test`). Never delete an applied migration folder, even one that is reverted by a later migration; Prisma treats a missing folder as drift.
- `npm run prisma:seed` — run `prisma/seed.ts`.
- `npm test` — unit tests (`jest --config jest.config.json`).
- `npm run test:e2e` — e2e tests (`jest --config test/jest-e2e.json --runInBand`); run a single e2e file with `npm run test:e2e -- test/correction-flows.e2e-spec.ts`.
- Requires `DATABASE_URL`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `PORT` (see `.env.example`); default `PORT=4000`.
- Local databases (PostgreSQL 18): `obbel_dev` for `npm run dev` (`.env`) and `obbel_test` for e2e (`.env.test`, loaded by `test/jest-e2e.setup.ts`). Create each with `CREATE DATABASE <name> ENCODING 'UTF8' TEMPLATE template0;`, then `npm run prisma:deploy` and `npm run prisma:seed` (dummy logins `admin`, `owner`, `booth01`, password `obbel123`; e2e depends on them).

### Admin web (`apps/admin_web/`)
- `npm run dev` — Next.js dev server.
- `npm run build` / `npm run start` — production build/run.
- `npm run lint` — ESLint.
- Requires `NEXT_PUBLIC_API_URL` pointing at the backend (see `.env.example`).

### Android shell (`apps/booth_pwa_flutter/`)
- `flutter pub get`, `flutter run`, `flutter analyze` — standard Flutter workflow, run from that directory. The PWA URL comes from `--dart-define=PWA_URL=...` (default: live). Against a local dev server: `adb reverse tcp:3000 tcp:3000` and `tcp:4000 tcp:4000`, then `PWA_URL=http://localhost:3000/petugas/login` (localhost keeps the secure context that GPS and the camera need).

## Architecture

### Non-negotiable domain rules (see `AGENTS.md` and `docs/spec/24-data-consistency-correction-reversal.md` before touching any mutation)
- **Data consistency is P0.** Posted transactions are never hard-deleted or directly edited. Every mutable transaction type has an explicit correction/reversal/revision path (e.g. `reviseSale()`, `voidSale()`, `correctDistributionReceipt()`, `confirmStockOpname()`, `reverseAdjustment()`) — do not add generic CRUD update/delete for posted transactions.
- Stock only changes through backend domain services that write an append-only `StockMovement` row inside a DB transaction. `WarehouseStock`/`BoothStock` rows are projections that must stay reconcilable from the ledger — never `UPDATE` a stock quantity directly from a client or controller.
- Money is stored as integer Rupiah (no floats). Cup quantities are integer. Timestamps are stored UTC (`timestamptz`) and rendered in `Asia/Jakarta` in UI.
- Nothing is hardcoded: booth list, shift times, products, prices, stock thresholds, and users all come from master/config data.
- Authorization (role + booth scoping) is enforced in the backend service/application layer, not in the database (no RLS) and not trusted from client-supplied `role`/`booth_id`/totals.
- Roles: Petugas Booth is restricted to their assigned booth/shift; Admin Pusat can act across booths; Owner is strictly read-only.
- Admin access is further limited per admin-web menu by Owner-defined access roles (BR-044). Every endpoint that ADMIN/OWNER can call must carry `@Menu(key, VIEW|MANAGE)`, `@Lookup()`, `@OwnerOnly()` or `@AccessCheckedInService()` (`backend/src/common/access/`); `RolesGuard` rejects untagged ones (fail-closed) and `test/rbac.e2e-spec.ts` fails on any untagged route. Menu keys live only in `backend/src/common/access/menus.ts`; admin_web `nav-config.ts` references them per item.
- Idempotency keys and UUIDs are required for critical transactions (sales, distributions, restock, returns, adjustments) to prevent duplicate posting on double-tap/retry.

### Backend structure (`backend/src`)
- `modules/` — one folder per domain area, each typically with its own `dto/`: `auth`, `booths`, `products`, `catalog`, `booth-stock`, `booth-stock-thresholds`, `warehouse-stock`, `distributions`, `restock-requests`, `returns`, `sales`, `shifts`, `shift-templates`, `stock-adjustments`, `stock-opname`, `reconciliation-cases`, `corrections`, `dashboard`, `reports`, `notifications`, `users`.
- `prisma/schema.prisma` defines the full relational model (Booth, Product, ShiftSession, BoothStock/WarehouseStock, Sale/SaleItem/Payment/SaleRefund, StockMovement, StockDistribution, RestockRequest, ShiftStockCount, StockReturn, TransactionCorrection, ReconciliationCase, StockOpname, ...). Any schema change goes through a Prisma migration, never a manual production schema edit.
- Correction/reversal mutation flow (see `02-system-architecture.md` §"Correction & Reconciliation Domain"): authorize → validate current state → impact preview/dependency check → reverse original effect → post replacement/correction → update stock & payment projections → recalculate aggregates/reconciliation → write audit log → commit atomically. This logic lives only in backend domain services, never duplicated in clients.
- Transaction boundaries that must be a single DB transaction: receiving a distribution, creating a sale (with stock deduction), receiving a restock, receiving a return, stock adjustment, and shift closing when it produces a discrepancy record.

### Client architecture
- Screens never call the backend or manipulate stock directly: they go through `lib/api-client`. Critical stock mutations are always server-side calls, not local state edits.
- `admin_web` uses Next.js App Router; conventional layout is `app/ (routes)`, `components/`, `features/`, `services`/`repositories`, `lib/api-client`, `schemas`.
- `booth_pwa_flutter` only exposes device features to the PWA through a JS bridge (`lib/bridge/bridge_protocol.dart` ↔ `apps/admin_web/src/app/petugas/_lib/native-bridge.ts`); keep the two sides of that contract in sync.

### Formatting conventions used across clients
- Rupiah: `Rp24.560.000`. Quantity: `10 cup`. Date/time: `23 Agu 2026, 15.40` (Asia/Jakarta).
- Code/domain identifiers are English (`RestockRequest`); UI copy is Bahasa Indonesia.

## Where to look for feature specs

`docs/spec/` is numbered by concern — check the relevant one before implementing:
`03` roles/permissions, `05` feature spec, `07` database schema, `08` business rules, `09` API/RPC contract, `10` state machines, `12` reporting/dashboard KPIs, `13` security/audit, `24` correction/reversal rules (read before any mutation work), `25` per-transaction cancel/revise impact matrix.
