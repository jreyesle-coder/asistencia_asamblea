-- =====================================================================
-- CODIA · Votaciones digitales (migración 0009)
-- Roles presidente/tecnología, credencial de votante por asistencia,
-- iniciativas + votos (nominal), y funciones de presidente/votante.
-- Ejecutar UNA vez en Supabase → SQL Editor.
-- NO re-ejecutar después de la 0010: volvería a crear emitir_voto(text,text)
-- y dejaría dos sobrecargas (ambigüedad en PostgREST).
-- =====================================================================

-- 1) Roles nuevos ------------------------------------------------------
alter table profiles drop constraint if exists profiles_rol_check;
alter table profiles add constraint profiles_rol_check
  check (rol in ('admin','registrador','presidente','tecnologia'));

-- is_admin incluye 'tecnologia' (soporte con acceso total). presidente NO es admin.
create or replace function is_admin() returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles p
    where p.id = auth.uid() and p.activo and p.rol in ('admin','tecnologia'));
$$;

-- Control de votación: presidente o tecnología (respaldo).
create or replace function is_presidente() returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles p
    where p.id = auth.uid() and p.activo and p.rol in ('presidente','tecnologia'));
$$;

-- 2) Credencial de votante (vive en asistencia; se limpia al cerrar asamblea)
alter table asistencia add column if not exists voto_token  text;
alter table asistencia add column if not exists voto_codigo text;
alter table asistencia alter column voto_token
  set default replace(gen_random_uuid()::text, '-', '');
alter table asistencia alter column voto_codigo
  set default upper(substring(md5(random()::text) from 1 for 6));
update asistencia set voto_token  = replace(gen_random_uuid()::text,'-','') where voto_token  is null;
update asistencia set voto_codigo = upper(substring(md5(random()::text) from 1 for 6)) where voto_codigo is null;
alter table asistencia alter column voto_token  set not null;
alter table asistencia alter column voto_codigo set not null;
create unique index if not exists asistencia_voto_token_idx on asistencia(voto_token);

-- 3) Iniciativas y votos ----------------------------------------------
create table if not exists iniciativas (
  id          bigint generated always as identity primary key,
  asamblea_id bigint not null references asambleas(id) on delete cascade,
  titulo      text not null,
  descripcion text,
  estado      text not null default 'abierta' check (estado in ('abierta','cerrada')),
  creada_por  text,
  abierta_at  timestamptz not null default now(),
  cerrada_at  timestamptz
);
create index if not exists iniciativas_asamblea_idx on iniciativas(asamblea_id);

create table if not exists votos (
  id                bigint generated always as identity primary key,
  iniciativa_id     bigint not null references iniciativas(id) on delete cascade,
  asambleista_id    bigint not null references asambleistas(id),
  asambleista_nombre text,
  colegiatura       int,
  delegacion        text,
  opcion            text not null check (opcion in ('favor','contra','abstencion')),
  hora              timestamptz not null default now(),
  unique (iniciativa_id, asambleista_id)
);
create index if not exists votos_iniciativa_idx on votos(iniciativa_id);

-- 4) RLS: el staff lee; las escrituras van por funciones security definer
alter table iniciativas enable row level security;
alter table votos       enable row level security;
drop policy if exists "staff lee iniciativas" on iniciativas;
create policy "staff lee iniciativas" on iniciativas for select using (is_staff());
drop policy if exists "staff lee votos" on votos;
create policy "staff lee votos" on votos for select using (is_staff());

-- 5) Funciones del presidente -----------------------------------------
create or replace function abrir_iniciativa(p_titulo text, p_descripcion text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_asamblea bigint; v_nombre text; v_id bigint;
begin
  if not is_presidente() then raise exception 'No autorizado: solo el presidente.'; end if;
  select id into v_asamblea from asambleas where estado='activa' order by id desc limit 1;
  if v_asamblea is null then raise exception 'No hay una asamblea abierta.'; end if;
  if exists (select 1 from iniciativas where asamblea_id=v_asamblea and estado='abierta') then
    raise exception 'Ya hay una votación abierta. Ciérrala antes de abrir otra.';
  end if;
  select nombre into v_nombre from profiles where id=auth.uid();
  insert into iniciativas (asamblea_id, titulo, descripcion, creada_por)
  values (v_asamblea, p_titulo, nullif(trim(p_descripcion),''), v_nombre)
  returning id into v_id;
  return jsonb_build_object('id', v_id);
end $$;
grant execute on function abrir_iniciativa(text, text) to authenticated;

create or replace function cerrar_iniciativa(p_id bigint)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not is_presidente() then raise exception 'No autorizado: solo el presidente.'; end if;
  update iniciativas set estado='cerrada', cerrada_at=now() where id=p_id and estado='abierta';
  return jsonb_build_object('ok', true);
end $$;
grant execute on function cerrar_iniciativa(bigint) to authenticated;

-- 6) Funciones del votante (anónimas, validadas por token) ------------
create or replace function votante_sesion(p_token text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_aid bigint; v_nombre text; v_col int; v_del text;
        v_ini_id bigint; v_ini_tit text; v_ini_desc text; v_mi text;
begin
  select asambleista_id into v_aid from asistencia where voto_token = p_token;
  if v_aid is null then return jsonb_build_object('ok', false, 'motivo', 'token'); end if;
  select nombre, colegiatura, delegacion into v_nombre, v_col, v_del
    from asambleistas where id = v_aid;
  select i.id, i.titulo, i.descripcion into v_ini_id, v_ini_tit, v_ini_desc
    from iniciativas i join asambleas a on a.id=i.asamblea_id and a.estado='activa'
    where i.estado='abierta' order by i.id desc limit 1;
  if v_ini_id is not null then
    select opcion into v_mi from votos where iniciativa_id=v_ini_id and asambleista_id=v_aid;
  end if;
  return jsonb_build_object(
    'ok', true, 'nombre', v_nombre, 'colegiatura', v_col, 'delegacion', v_del,
    'iniciativa', case when v_ini_id is null then null
      else jsonb_build_object('id',v_ini_id,'titulo',v_ini_tit,'descripcion',v_ini_desc) end,
    'ya_voto', v_mi is not null, 'mi_voto', v_mi);
end $$;
grant execute on function votante_sesion(text) to anon, authenticated;

create or replace function emitir_voto(p_token text, p_opcion text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_aid bigint; v_nombre text; v_col int; v_del text; v_ini bigint;
begin
  if p_opcion not in ('favor','contra','abstencion') then raise exception 'Opción inválida'; end if;
  select asambleista_id into v_aid from asistencia where voto_token = p_token;
  if v_aid is null then return jsonb_build_object('ok', false, 'motivo', 'token'); end if;
  select nombre, colegiatura, delegacion into v_nombre, v_col, v_del from asambleistas where id=v_aid;
  select i.id into v_ini from iniciativas i join asambleas a on a.id=i.asamblea_id and a.estado='activa'
    where i.estado='abierta' order by i.id desc limit 1;
  if v_ini is null then return jsonb_build_object('ok', false, 'motivo', 'cerrada'); end if;
  insert into votos (iniciativa_id, asambleista_id, asambleista_nombre, colegiatura, delegacion, opcion)
  values (v_ini, v_aid, v_nombre, v_col, v_del, p_opcion)
  on conflict (iniciativa_id, asambleista_id) do nothing;
  return jsonb_build_object('ok', true);
end $$;
grant execute on function emitir_voto(text, text) to anon, authenticated;

-- Recuperación: resolver token por colegiatura + código
create or replace function votante_por_codigo(p_colegiatura int, p_codigo text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_token text;
begin
  select a.voto_token into v_token from asistencia a
    join asambleistas m on m.id=a.asambleista_id
    where m.colegiatura=p_colegiatura and upper(a.voto_codigo)=upper(trim(p_codigo));
  if v_token is null then return jsonb_build_object('ok', false); end if;
  return jsonb_build_object('ok', true, 'token', v_token);
end $$;
grant execute on function votante_por_codigo(int, text) to anon, authenticated;
