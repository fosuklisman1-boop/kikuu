-- ============================================================
-- PROFILES (role source of truth)
-- ============================================================
create table public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  role       text not null default 'customer' check (role in ('customer', 'admin')),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Users can read their own profile (needed for proxy/layout role checks)
create policy "profiles_own_read" on public.profiles
  for select using (auth.uid() = id);

-- Admins can read all profiles
create policy "profiles_admin_read" on public.profiles
  for select using (public.is_admin());

-- No public write — role changes go through service role only

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, role)
  values (new.id, coalesce(new.raw_app_meta_data->>'role', 'customer'))
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Update is_admin() to use profiles table instead of JWT claims
create or replace function public.is_admin()
returns boolean language sql stable security definer as $$
  select exists(
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  )
$$;

-- Backfill existing users (copies role from app_metadata if already set)
insert into public.profiles (id, role)
select
  id,
  coalesce(raw_app_meta_data->>'role', 'customer') as role
from auth.users
on conflict (id) do update set role = excluded.role;
