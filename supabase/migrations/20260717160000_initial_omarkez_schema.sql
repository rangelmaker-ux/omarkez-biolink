begin;

-- =========================================================
-- @omarkez_ Bio Link — banco, segurança e Storage
-- =========================================================

create schema if not exists private;

revoke all on schema private from public;
grant usage on schema private to anon, authenticated;

-- =========================================================
-- Modelos
-- =========================================================

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

comment on table public.admin_users is
  'Usuários do Supabase Auth autorizados a administrar o site.';

create table if not exists public.site_settings (
  id smallint primary key default 1 check (id = 1),
  handle text not null default '@omarkez_',
  subtitle text not null default 'Toque em um perfil para acessar os conteúdos.',
  footer_text text not null default 'Conteúdo e configurações por @omarkez_',
  accent_color text not null default '#e50914'
    check (accent_color ~ '^#[0-9a-fA-F]{6}$'),
  motion_enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

comment on table public.site_settings is
  'Configurações globais de identidade e aparência do site.';

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique
    check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  name text not null,
  short_name text not null,
  description text,
  image_url text,
  link_url text,
  sort_order integer not null default 0 check (sort_order >= 0),
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is
  'Perfis exibidos no carrossel principal.';

create table if not exists public.cards (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  description text,
  button_label text not null default 'Acessar',
  kind text not null default 'link' check (kind in ('link', 'download')),
  image_url text,
  external_url text,
  storage_path text,
  file_name text,
  open_in_new_tab boolean not null default true,
  sort_order integer not null default 0 check (sort_order >= 0),
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    is_published = false
    or external_url is not null
    or storage_path is not null
  )
);

comment on table public.cards is
  'Links e downloads publicados dentro de cada perfil.';

create index if not exists profiles_public_order_idx
  on public.profiles (is_published, sort_order);

create index if not exists cards_profile_order_idx
  on public.cards (profile_id, is_published, sort_order);

-- =========================================================
-- Funções auxiliares
-- =========================================================

create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.admin_users
    where user_id = (select auth.uid())
  );
$$;

revoke all on function private.is_admin() from public;
grant execute on function private.is_admin() to anon, authenticated;

create or replace function private.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists site_settings_updated_at on public.site_settings;
create trigger site_settings_updated_at
before update on public.site_settings
for each row execute function private.touch_updated_at();

drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at
before update on public.profiles
for each row execute function private.touch_updated_at();

drop trigger if exists cards_updated_at on public.cards;
create trigger cards_updated_at
before update on public.cards
for each row execute function private.touch_updated_at();

-- =========================================================
-- Permissões e Row Level Security
-- =========================================================

alter table public.admin_users enable row level security;
alter table public.site_settings enable row level security;
alter table public.profiles enable row level security;
alter table public.cards enable row level security;

revoke all on public.admin_users from anon, authenticated;
revoke all on public.site_settings from anon, authenticated;
revoke all on public.profiles from anon, authenticated;
revoke all on public.cards from anon, authenticated;

grant select on public.admin_users to authenticated;

grant select on public.site_settings to anon, authenticated;
grant update on public.site_settings to authenticated;

grant select on public.profiles to anon, authenticated;
grant insert, update, delete on public.profiles to authenticated;

grant select on public.cards to anon, authenticated;
grant insert, update, delete on public.cards to authenticated;

drop policy if exists "admin reads own membership" on public.admin_users;
create policy "admin reads own membership"
on public.admin_users
for select
to authenticated
using (user_id = (select auth.uid()));

drop policy if exists "public reads settings" on public.site_settings;
create policy "public reads settings"
on public.site_settings
for select
to anon, authenticated
using (true);

drop policy if exists "admins update settings" on public.site_settings;
create policy "admins update settings"
on public.site_settings
for update
to authenticated
using ((select private.is_admin()))
with check (id = 1 and (select private.is_admin()));

drop policy if exists "public reads published profiles" on public.profiles;
create policy "public reads published profiles"
on public.profiles
for select
to anon, authenticated
using (is_published = true);

drop policy if exists "admins manage profiles" on public.profiles;
create policy "admins manage profiles"
on public.profiles
for all
to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

drop policy if exists "public reads published cards" on public.cards;
create policy "public reads published cards"
on public.cards
for select
to anon, authenticated
using (
  is_published = true
  and profile_id in (
    select id
    from public.profiles
    where is_published = true
  )
);

drop policy if exists "admins manage cards" on public.cards;
create policy "admins manage cards"
on public.cards
for all
to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

-- =========================================================
-- Storage público com escrita exclusiva do administrador
-- =========================================================

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'omarkez-media',
  'omarkez-media',
  true,
  52428800,
  array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/avif',
    'image/gif',
    'image/heic',
    'image/heif',
    'application/pdf',
    'application/zip',
    'application/x-zip-compressed',
    'application/octet-stream',
    'text/plain'
  ]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "admins read media metadata" on storage.objects;
create policy "admins read media metadata"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'omarkez-media'
  and (select private.is_admin())
);

drop policy if exists "admins upload media" on storage.objects;
create policy "admins upload media"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'omarkez-media'
  and (select private.is_admin())
);

drop policy if exists "admins update media" on storage.objects;
create policy "admins update media"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'omarkez-media'
  and (select private.is_admin())
)
with check (
  bucket_id = 'omarkez-media'
  and (select private.is_admin())
);

drop policy if exists "admins delete media" on storage.objects;
create policy "admins delete media"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'omarkez-media'
  and (select private.is_admin())
);

-- =========================================================
-- Dados iniciais
-- =========================================================

insert into public.site_settings (
  id,
  handle,
  subtitle,
  footer_text,
  accent_color,
  motion_enabled
)
values (
  1,
  '@omarkez_',
  'Toque em um perfil para acessar os conteúdos.',
  'Conteúdo e configurações por @omarkez_',
  '#e50914',
  true
)
on conflict (id) do nothing;

insert into public.profiles (
  id,
  slug,
  name,
  short_name,
  image_url,
  link_url,
  sort_order,
  is_published
)
values
  (
    '10000000-0000-4000-8000-000000000001',
    'luts',
    'LUTs',
    'LUTs',
    '/profile-luts.png',
    null,
    10,
    true
  ),
  (
    '10000000-0000-4000-8000-000000000002',
    'sony-zv-e10',
    'Configurações Sony ZV-E10 Mark II',
    'ZV-E10',
    '/profile-sony-zve10.png',
    null,
    20,
    true
  ),
  (
    '10000000-0000-4000-8000-000000000003',
    'blackmagic-cam',
    'Configurações Blackmagic Cam',
    'BMC',
    '/profile-blackmagic.png',
    null,
    30,
    true
  ),
  (
    '10000000-0000-4000-8000-000000000004',
    'contato-whatsapp',
    'Contato • WhatsApp',
    'WhatsApp',
    '/profile-contact.jpg',
    'https://wa.me/5566992352452?text=Ol%C3%A1%21%20Vim%20pelo%20seu%20perfil%20e%20gostaria%20de%20solicitar%20um%20or%C3%A7amento.',
    40,
    true
  )
on conflict (slug) do nothing;

commit;
