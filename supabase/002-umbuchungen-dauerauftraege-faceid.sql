-- Migration for an existing database (run once in Supabase → SQL Editor).
-- Adds transfers, standing orders and Face ID passkeys. Keeps all data.

-- Both halves of a transfer share a transfer_id; bookings made by a standing
-- order carry its recurring_id.
alter table transactions add column if not exists transfer_id text;
alter table transactions add column if not exists recurring_id text;
create index if not exists transactions_transfer_idx on transactions (transfer_id);

-- Daueraufträge. amount is always positive; kind says the direction.
-- Bookings are created up to today whenever the app loads its data and by
-- the daily cron; last_date is the last occurrence already booked.
create table if not exists recurrings (
    id            text primary key,
    kind          text not null check (kind in ('out', 'in', 'transfer')),
    account_id    text not null references accounts(id) on delete cascade,
    to_account_id text references accounts(id) on delete cascade,
    amount        numeric not null check (amount > 0),
    counterparty  text,
    category      text,
    purpose       text,
    interval      text not null check (interval in ('week', 'month', 'year')),
    every         integer not null default 1 check (every > 0),
    start_date    date not null,
    end_date      date,
    last_date     date,
    created_at    timestamptz not null default now()
);

-- Face ID / Touch ID login (WebAuthn passkeys), one row per device.
create table if not exists passkeys (
    id         text primary key,
    public_key text not null,
    counter    bigint not null default 0,
    transports text,
    created_at timestamptz not null default now()
);

alter table recurrings enable row level security;
alter table passkeys   enable row level security;
