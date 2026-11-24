-- Starter schema reference for AI Coding Agent.
-- Target: PostgreSQL self-hosted di Coolify, diakses melalui Backend API custom (Node.js/NestJS).
-- Final migration must be reviewed and may split enums/tables/functions.
-- Authorization (role & booth scoping) is enforced in the backend service layer, not via Postgres RLS.

create extension if not exists pgcrypto;

create type public.user_role as enum ('BOOTH_STAFF','ADMIN','OWNER');
create type public.booth_status as enum ('ACTIVE','INACTIVE');
create type public.shift_status as enum ('SCHEDULED','OPEN','CLOSING','CLOSED','CANCELLED');
create type public.distribution_status as enum ('DRAFT','SENT','RECEIVED','DISCREPANCY','CANCELLED');
create type public.restock_status as enum ('REQUESTED','APPROVED','REJECTED','PREPARED','SENT','RECEIVED','DISCREPANCY','CANCELLED');
create type public.return_status as enum ('DRAFT','SUBMITTED','RECEIVED','DISCREPANCY','CANCELLED');
create type public.sale_status as enum ('PENDING','PAID','VOIDED');
create type public.payment_method as enum ('CASH','QRIS');
create type public.stock_movement_type as enum ('OPENING','WAREHOUSE_TO_BOOTH','SALE','RESTOCK','RETURN_TO_WAREHOUSE','ADJUSTMENT','VOID_REVERSAL');

create table public.booths (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  location_name text,
  address text,
  latitude numeric,
  longitude numeric,
  status public.booth_status not null default 'ACTIVE',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  username text not null unique,
  password_hash text not null,
  full_name text not null,
  role public.user_role not null,
  default_booth_id uuid references public.booths(id),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.product_categories (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  sort_order int not null default 0,
  active boolean not null default true
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  sku text not null unique,
  name text not null,
  category_id uuid references public.product_categories(id),
  sell_price bigint not null check (sell_price >= 0),
  image_url text,
  active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.shift_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  start_time time not null,
  end_time time not null,
  active boolean not null default true
);

create table public.shift_sessions (
  id uuid primary key default gen_random_uuid(),
  business_date date not null,
  booth_id uuid not null references public.booths(id),
  shift_template_id uuid not null references public.shift_templates(id),
  staff_id uuid not null references public.profiles(id),
  status public.shift_status not null default 'SCHEDULED',
  scheduled_start_at timestamptz not null,
  scheduled_end_at timestamptz not null,
  opened_at timestamptz,
  closing_started_at timestamptz,
  closed_at timestamptz,
  closing_note text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.warehouse_stocks (
  product_id uuid primary key references public.products(id),
  qty_on_hand int not null default 0 check (qty_on_hand >= 0),
  qty_reserved int not null default 0 check (qty_reserved >= 0),
  version bigint not null default 0,
  updated_at timestamptz not null default now(),
  check (qty_reserved <= qty_on_hand)
);

create table public.booth_stocks (
  booth_id uuid not null references public.booths(id),
  product_id uuid not null references public.products(id),
  qty_on_hand int not null default 0 check (qty_on_hand >= 0),
  version bigint not null default 0,
  updated_at timestamptz not null default now(),
  primary key (booth_id, product_id)
);

create table public.booth_stock_thresholds (
  booth_id uuid not null references public.booths(id),
  product_id uuid not null references public.products(id),
  minimum_qty int not null default 5 check (minimum_qty >= 0),
  critical_qty int not null default 2 check (critical_qty >= 0),
  primary key (booth_id, product_id),
  check (critical_qty <= minimum_qty)
);

-- Transaction tables/RPC/RLS should be generated from 07-database-schema.md
-- rather than treating this starter file as the final complete migration.

-- ---------------------------------------------------------------------------
-- Data consistency / correction foundation (Documentation v1.1)
-- See 24-data-consistency-correction-reversal.md.
-- ---------------------------------------------------------------------------

create type public.correction_type as enum (
  'VOID','REVISION','RECOUNT','ADJUSTMENT','PAYMENT_CORRECTION'
);
create type public.correction_status as enum ('PENDING','POSTED','FAILED');
create type public.opname_location_type as enum ('WAREHOUSE','BOOTH');
create type public.opname_status as enum ('DRAFT','CONFIRMED','SUPERSEDED');
create type public.reconciliation_status as enum ('OPEN','RESOLVED','IGNORED');
create type public.reconciliation_severity as enum ('INFO','WARNING','CRITICAL');

create table public.transaction_corrections (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  entity_id uuid not null,
  transaction_group_id uuid not null,
  correction_type public.correction_type not null,
  original_version_id uuid,
  replacement_version_id uuid,
  reason_code text not null,
  reason_note text,
  impact_snapshot jsonb not null default '{}'::jsonb,
  status public.correction_status not null default 'PENDING',
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  posted_at timestamptz,
  idempotency_key uuid not null unique
);

create index transaction_corrections_entity_idx
  on public.transaction_corrections(entity_type, entity_id, created_at desc);
create index transaction_corrections_group_idx
  on public.transaction_corrections(transaction_group_id, created_at desc);

create table public.stock_opnames (
  id uuid primary key default gen_random_uuid(),
  opname_no text not null unique,
  location_type public.opname_location_type not null,
  booth_id uuid references public.booths(id),
  business_date date not null,
  status public.opname_status not null default 'DRAFT',
  transaction_group_id uuid not null,
  version_no int not null default 1 check (version_no > 0),
  revision_of_id uuid references public.stock_opnames(id),
  snapshot_at timestamptz not null default now(),
  confirmed_at timestamptz,
  counted_by uuid not null references public.profiles(id),
  correction_reason_code text,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (location_type = 'BOOTH' and booth_id is not null)
    or (location_type = 'WAREHOUSE' and booth_id is null)
  )
);

create unique index stock_opname_group_version_uniq
  on public.stock_opnames(transaction_group_id, version_no);

create table public.stock_opname_items (
  id uuid primary key default gen_random_uuid(),
  stock_opname_id uuid not null references public.stock_opnames(id),
  product_id uuid not null references public.products(id),
  expected_qty int not null check (expected_qty >= 0),
  actual_qty int not null check (actual_qty >= 0),
  discrepancy_qty int not null,
  adjustment_movement_id uuid,
  reason_code text,
  reason_note text,
  unique(stock_opname_id, product_id),
  check (discrepancy_qty = actual_qty - expected_qty)
);

create table public.reconciliation_cases (
  id uuid primary key default gen_random_uuid(),
  case_no text not null unique,
  source_entity_type text not null,
  source_entity_id uuid not null,
  status public.reconciliation_status not null default 'OPEN',
  severity public.reconciliation_severity not null default 'WARNING',
  reason_code text not null,
  details jsonb not null default '{}'::jsonb,
  resolved_by uuid references public.profiles(id),
  resolved_at timestamptz,
  resolution_note text,
  created_at timestamptz not null default now()
);

create index reconciliation_cases_open_idx
  on public.reconciliation_cases(status, severity, created_at desc);

-- IMPORTANT IMPLEMENTATION NOTE:
-- Transaction tables defined from 07-database-schema.md must adopt lineage fields
-- (transaction_group_id, version_no, revision_of_id, reversal_of_id / superseded_by_id,
-- posting/effective status, reason metadata). Posted stock movements and posted
-- transaction versions must be protected from UPDATE/DELETE by database privileges/
-- trigger rules, enforced together with the backend service layer. Corrections must
-- be expressed as compensating/replacement records.
