-- Migration (run once in Supabase → SQL Editor, in the finanzboard project).
-- An account can be a depot: its value is entered by hand ("Wert
-- aktualisieren"), money moves in as a transfer with category Investieren.
alter table accounts add column if not exists kind text not null default 'cash' check (kind in ('cash', 'depot'));
