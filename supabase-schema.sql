-- Run once in Supabase → SQL Editor.

-- One row per bank consent (Enable Banking session). Expires after valid_until;
-- reconnecting the bank creates a new one.
create table if not exists bank_sessions (
    id          text primary key,
    aspsp_name  text not null,
    valid_until timestamptz not null,
    created_at  timestamptz not null default now()
);

create table if not exists accounts (
    uid          text primary key,
    session_id   text not null references bank_sessions(id) on delete cascade,
    bank         text not null,
    iban         text,
    name         text,
    currency     text not null default 'EUR',
    balance      numeric,
    balance_date date,
    updated_at   timestamptz not null default now()
);

-- amount is signed: negative = Ausgabe, positive = Einnahme.
create table if not exists transactions (
    id           text primary key,
    account_uid  text not null references accounts(uid) on delete cascade,
    booking_date date not null,
    amount       numeric not null,
    currency     text not null default 'EUR',
    counterparty text,
    purpose      text,
    status       text not null default 'BOOK',
    raw          jsonb
);
create index if not exists transactions_booking_date_idx on transactions (booking_date desc);

create table if not exists sync_log (
    id      bigserial primary key,
    at      timestamptz not null default now(),
    ok      boolean not null,
    message text
);

-- Only the server (service role) touches these tables. RLS on with no policies
-- means the anon key can read nothing.
alter table bank_sessions enable row level security;
alter table accounts      enable row level security;
alter table transactions  enable row level security;
alter table sync_log      enable row level security;
