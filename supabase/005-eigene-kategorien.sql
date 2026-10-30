-- Migration (run once in Supabase → SQL Editor, in the finanzboard project).
-- Categories a Haushalt adds on top of the defaults in src/shared/categories.js.
-- Transactions keep storing the category by name.
create table if not exists categories (
    id         text primary key,
    space_id   text not null references spaces(id) on delete cascade,
    name       text not null,
    kind       text not null check (kind in ('out', 'in')),
    icon       text not null default 'Tag',
    created_at timestamptz not null default now()
);
create unique index if not exists categories_space_name_idx on categories (space_id, lower(name));
alter table categories enable row level security;
