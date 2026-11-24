# 18 — AI Agent Implementation Plan

Dokumen ini memberi urutan kerja agar AI Coding Agent tidak langsung membuat UI tanpa fondasi.

## Phase 0 — Read & Plan
Agent harus membaca seluruh docs dan menghasilkan checklist implementasi. Jangan coding sebelum menyebut asumsi yang belum pasti.

## Phase 1 — Backend Foundation
1. Init backend project (Node.js/NestJS) dan provision PostgreSQL di Coolify.
2. Buat enums.
3. Buat master tables.
4. Buat transaction tables.
5. Buat indexes/constraints.
6. Buat authorization/role & booth-scoping layer di backend (service guard, bukan RLS).
7. Buat seed.
8. Buat reporting views dasar.

Output: migrations versioned.

## Phase 2 — Domain RPC
Implement dan test:
- receive_distribution;
- create_paid_sale;
- create_restock_request;
- approve/send restock;
- receive_restock;
- start_shift_closing;
- confirm_shift_closing;
- submit_return;
- receive_return;
- adjust_stock;
- void_sale.

Setiap RPC memiliki idempotency, role check, audit, transaction.

## Phase 3 — Flutter Booth Skeleton
- theme;
- auth;
- routing;
- repository abstraction;
- bottom nav;
- dummy screens.

Lalu hubungkan backend per vertical flow:
1. login/assignment;
2. inbound receive;
3. POS/payment;
4. stock/restock;
5. closing/return;
6. printer adapter.

## Phase 4 — Admin Web
1. auth/role;
2. dashboard;
3. distribution;
4. restock;
5. return;
6. stock monitor;
7. sales;
8. reports;
9. master.

PWA config setelah functionality stabil, bukan sebagai pengganti web architecture.

## Phase 5 — Flutter Owner
1. auth;
2. executive home;
3. ranking;
4. booth detail;
5. sales analytics;
6. stock condition;
7. discrepancy;
8. reports.

Pastikan repository tidak menyediakan mutation operational.

## Phase 6 — Realtime & Notification
Subscribe event yang relevan, bukan seluruh DB.

## Phase 7 — Hardening
- concurrency tests;
- permission tests;
- duplicate submit;
- timezone;
- slow network;
- empty state;
- printer failure;
- responsive Admin.

## Phase 8 — Production Readiness
- env config;
- migrations;
- seed production master manually/import;
- APK/AAB signing;
- PWA deploy;
- backup;
- monitoring.

## AI Agent guardrails
Agent dilarang:
- membuat tiga backend terpisah;
- menyimpan stok hanya di local app;
- hardcode quantity initial 10;
- menganggap 14 penjaga = 14 Booth;
- hardcode shift time;
- memberi Owner mutation permission;
- melakukan direct stock update tanpa movement;
- menghapus sale/movement untuk koreksi;
- menghitung harga final hanya di client.

## Completion output setiap phase
Agent wajib melaporkan:
- file yang dibuat/diubah;
- migration yang ditambah;
- test yang dijalankan;
- requirement doc yang dipenuhi;
- issue/assumption tersisa.

## Mandatory consistency milestone

Sebelum UI dianggap production-ready, AI Agent wajib mengimplementasikan correction foundation:
1. transaction lineage/version convention;
2. immutable stock ledger;
3. transaction correction/audit table;
4. sale void + revision;
5. distribution/restock/return correction;
6. stock opname + recount;
7. manual adjustment + reversal;
8. reconciliation engine;
9. impact preview;
10. consistency acceptance tests.

Jangan menunda seluruh correction engine ke fase setelah aplikasi dipakai karena schema dan ledger pattern akan jauh lebih sulit diperbaiki setelah ada data production.
