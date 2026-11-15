-- ============================================================
-- SUPPORT SETTINGS (single-row config: customer support contact details)
-- Public read (shown in storefront footers / order tracking); writes go
-- through the admin server action using the service role.
-- ============================================================
create table public.support_settings (
  id          boolean primary key default true,
  email       text not null default '',
  phone       text not null default '',
  whatsapp    text not null default '',
  updated_at  timestamptz not null default now(),
  constraint support_settings_singleton check (id = true)
);

insert into public.support_settings (id) values (true);

create trigger support_settings_updated_at
  before update on public.support_settings
  for each row execute function public.set_updated_at();

alter table public.support_settings enable row level security;

create policy "support_settings_public_read" on public.support_settings
  for select using (true);
