-- Tablica za sinkronizaciju aplikacije Moj Napredak.
-- Pokreni jednom u Supabase → SQL Editor.

create table if not exists public.app_state (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.app_state enable row level security;

-- Svaki korisnik smije čitati i pisati samo svoj redak.
drop policy if exists "app_state_select_own" on public.app_state;
drop policy if exists "app_state_insert_own" on public.app_state;
drop policy if exists "app_state_update_own" on public.app_state;

create policy "app_state_select_own" on public.app_state
  for select to authenticated using ((select auth.uid()) = user_id);

create policy "app_state_insert_own" on public.app_state
  for insert to authenticated with check ((select auth.uid()) = user_id);

create policy "app_state_update_own" on public.app_state
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- Novi Supabase projekti ne daju automatski prava na nove tablice.
grant select, insert, update on public.app_state to authenticated;
