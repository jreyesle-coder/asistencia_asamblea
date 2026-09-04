-- =====================================================================
-- CODIA · Asistencia de Asamblea — Esquema, RLS y roles
-- Ejecutar en Supabase → SQL Editor (una sola vez).
-- =====================================================================

-- ---------- Perfiles del personal (staff) ----------
create table if not exists profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  nombre     text not null,
  rol        text not null default 'registrador' check (rol in ('admin','registrador')),
  activo     boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------- Asambleístas (padrón de la asamblea) ----------
create table if not exists asambleistas (
  id          bigint generated always as identity primary key,
  orden       int  not null,
  nombre      text not null,
  colegiatura int  not null unique,
  cedula      text not null,
  cedula_norm text generated always as (regexp_replace(cedula, '[^0-9]', '', 'g')) stored,
  telefono    text,
  delegacion  text not null,
  plancha     text,
  cargo       text
);
create index if not exists asambleistas_cedula_norm_idx on asambleistas(cedula_norm);
create index if not exists asambleistas_colegiatura_idx  on asambleistas(colegiatura);

-- ---------- Asistencia (un registro por asambleísta) ----------
create table if not exists asistencia (
  id               bigint generated always as identity primary key,
  asambleista_id   bigint not null unique references asambleistas(id) on delete cascade,
  hora             timestamptz not null default now(),
  registrado_por   uuid default auth.uid() references auth.users(id),
  registrado_nombre text
);

-- ---------- Funciones de rol (evitan recursión en las policies) ----------
create or replace function is_staff() returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles p where p.id = auth.uid() and p.activo);
$$;

create or replace function is_admin() returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles p where p.id = auth.uid() and p.activo and p.rol = 'admin');
$$;

-- ---------- RLS ----------
alter table profiles     enable row level security;
alter table asambleistas enable row level security;
alter table asistencia   enable row level security;

drop policy if exists "perfil propio o admin" on profiles;
create policy "perfil propio o admin" on profiles
  for select using (auth.uid() = id or is_admin());

drop policy if exists "staff lee asambleistas" on asambleistas;
create policy "staff lee asambleistas" on asambleistas
  for select using (is_staff());

drop policy if exists "staff lee asistencia" on asistencia;
create policy "staff lee asistencia" on asistencia
  for select using (is_staff());

drop policy if exists "staff marca asistencia" on asistencia;
create policy "staff marca asistencia" on asistencia
  for insert with check (is_staff());

drop policy if exists "admin edita asistencia" on asistencia;
create policy "admin edita asistencia" on asistencia
  for update using (is_admin());

drop policy if exists "admin borra asistencia" on asistencia;
create policy "admin borra asistencia" on asistencia
  for delete using (is_admin());
