-- MeuTreino MVP: one versioned JSON document per authenticated user.
-- Client writes use revision as a compare-and-swap guard; this trigger owns the revision clock.

create table if not exists public.user_app_state (
  user_id uuid primary key
    constraint user_app_state_user_id_fkey
    references auth.users (id)
    on delete cascade,
  data jsonb not null default '{}'::jsonb
    constraint user_app_state_data_is_object
    check (jsonb_typeof(data) = 'object'),
  revision bigint not null default 1
    constraint user_app_state_revision_positive
    check (revision > 0),
  updated_at timestamptz not null default now()
);

comment on table public.user_app_state is
  'Local-first MeuTreino snapshot; exactly one JSONB document per Supabase Auth user.';
comment on column public.user_app_state.revision is
  'Server-owned compare-and-swap revision, incremented on every update.';

create or replace function public.set_user_app_state_metadata()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.revision := 1;
  else
    new.user_id := old.user_id;
    new.revision := old.revision + 1;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists set_user_app_state_metadata on public.user_app_state;
create trigger set_user_app_state_metadata
before insert or update on public.user_app_state
for each row execute function public.set_user_app_state_metadata();

alter table public.user_app_state enable row level security;

revoke all on table public.user_app_state from anon, authenticated;
grant select, insert, update on table public.user_app_state to authenticated;

drop policy if exists "Users can read their own app state" on public.user_app_state;
create policy "Users can read their own app state"
on public.user_app_state
for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can create their own app state" on public.user_app_state;
create policy "Users can create their own app state"
on public.user_app_state
for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their own app state" on public.user_app_state;
create policy "Users can update their own app state"
on public.user_app_state
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

-- Postgres Changes is used as an invalidation signal. The client always pulls and merges
-- the complete row after receiving an event, so disconnected devices reconcile on reconnect.
do $$
begin
  if exists (
    select 1 from pg_publication where pubname = 'supabase_realtime'
  ) and not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'user_app_state'
  ) then
    alter publication supabase_realtime add table public.user_app_state;
  end if;
end;
$$;
