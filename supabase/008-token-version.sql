-- Sessions end on a password change via users.token_version. Rows without
-- a value (null) logged people out right after signing in; give every row
-- a number and keep it that way.
alter table users add column if not exists token_version integer;
update users set token_version = 0 where token_version is null;
alter table users alter column token_version set default 0;
alter table users alter column token_version set not null;
