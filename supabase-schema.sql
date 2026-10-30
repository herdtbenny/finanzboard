-- Run in Supabase → SQL Editor. Safe to re-run: drops and recreates everything.
-- WARNING: the drop statements delete all stored data.

drop table if exists transactions;
drop table if exists accounts;
drop table if exists bank_sessions;
drop table if exists sync_log;
drop table if exists keep_alive;

-- Konten. Der Kontostand ist opening_balance + Summe aller Umsätze.
create table accounts (
    id              text primary key,
    name            text not null,
    opening_balance numeric not null default 0,
    sort_order      integer not null default 0,
    created_at      timestamptz not null default now()
);

-- amount is signed: negative = Ausgabe, positive = Einnahme.
create table transactions (
    id           text primary key,
    account_id   text not null references accounts(id) on delete cascade,
    booking_date date not null,
    amount       numeric not null,
    counterparty text,
    purpose      text,
    category     text,
    created_at   timestamptz not null default now()
);
create index transactions_booking_date_idx on transactions (booking_date desc, created_at desc);

-- Heartbeat of the daily keep-alive cron (api/keep-alive.js).
create table keep_alive (
    id bigserial primary key,
    at timestamptz not null default now()
);

-- Only the server (service role) touches these tables. RLS on with no policies
-- means the anon key can read nothing.
alter table accounts     enable row level security;
alter table transactions enable row level security;
alter table keep_alive   enable row level security;
