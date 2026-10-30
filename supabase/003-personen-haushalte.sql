-- Migration (run once in Supabase → SQL Editor, in the finanzboard project).
-- Several people, each with their own login. Data belongs to a Haushalt
-- (space); a person can be a member of several, and several people can share
-- one. Keeps all data; afterwards run `node scripts/setup-admin.js` once to
-- create the first person and move the existing data into their Haushalt.

create table if not exists users (
    id            text primary key,
    name          text not null,
    password_hash text not null,
    is_admin      boolean not null default false,
    created_at    timestamptz not null default now()
);
create unique index if not exists users_name_idx on users (lower(name));

create table if not exists spaces (
    id         text primary key,
    name       text not null,
    created_at timestamptz not null default now()
);

create table if not exists memberships (
    user_id  text not null references users(id) on delete cascade,
    space_id text not null references spaces(id) on delete cascade,
    primary key (user_id, space_id)
);

alter table accounts     add column if not exists space_id text references spaces(id) on delete cascade;
alter table transactions add column if not exists space_id text references spaces(id) on delete cascade;
alter table recurrings   add column if not exists space_id text references spaces(id) on delete cascade;
alter table passkeys     add column if not exists user_id  text references users(id)  on delete cascade;

create index if not exists accounts_space_idx     on accounts (space_id);
create index if not exists transactions_space_idx on transactions (space_id, booking_date desc);
create index if not exists recurrings_space_idx   on recurrings (space_id);

alter table users       enable row level security;
alter table spaces      enable row level security;
alter table memberships enable row level security;
