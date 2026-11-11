-- =====================================================================
-- CODIA · Ajustes de votaciones tras la revisión (migración 0010)
-- Requiere 0009. Segura de re-ejecutar. Ejecutar UNA vez en SQL Editor.
--  1) una sola iniciativa abierta por asamblea, garantizado en BD
--  2) emitir_voto exige la iniciativa que el votante tiene en pantalla
--  3) los votos sobreviven a recargas del padrón (FK on delete set null)
--  4) quitar la asistencia retira el voto de la votación en curso
--  5) cerrar la asamblea cierra cualquier votación abierta antes de archivar
--  6) las funciones privilegiadas no son ejecutables por anon
-- =====================================================================

-- 1) Sólo una iniciativa 'abierta' por asamblea (atómico, sin carreras)
create unique index if not exists iniciativas_una_abierta_idx
  on iniciativas (asamblea_id) where estado = 'abierta';

-- 2) emitir_voto(p_token, p_opcion, p_iniciativa_id)
--    Si el cliente envía la iniciativa que ve y ya no es la abierta → motivo 'cambio'.
--    p_iniciativa_id es opcional para seguir aceptando clientes antiguos.
drop function if exists emitir_voto(text, text);
create or replace function emitir_voto(p_token text, p_opcion text, p_iniciativa_id bigint default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_aid bigint; v_nombre text; v_col int; v_del text; v_ini bigint;
begin
  if p_opcion not in ('favor','contra','abstencion') then raise exception 'Opción inválida'; end if;
  select asambleista_id into v_aid from asistencia where voto_token = p_token;
  if v_aid is null then return jsonb_build_object('ok', false, 'motivo', 'token'); end if;
  select nombre, colegiatura, delegacion into v_nombre, v_col, v_del from asambleistas where id = v_aid;
  select i.id into v_ini from iniciativas i join asambleas a on a.id = i.asamblea_id and a.estado = 'activa'
    where i.estado = 'abierta' order by i.id desc limit 1;
  if v_ini is null then return jsonb_build_object('ok', false, 'motivo', 'cerrada'); end if;
  if p_iniciativa_id is not null and p_iniciativa_id <> v_ini then
    return jsonb_build_object('ok', false, 'motivo', 'cambio');
  end if;
  insert into votos (iniciativa_id, asambleista_id, asambleista_nombre, colegiatura, delegacion, opcion)
  values (v_ini, v_aid, v_nombre, v_col, v_del, p_opcion)
  on conflict (iniciativa_id, asambleista_id) do nothing;
  return jsonb_build_object('ok', true);
end $$;
grant execute on function emitir_voto(text, text, bigint) to anon, authenticated;

-- 3) El acta nominal usa las columnas desnormalizadas (nombre/colegiatura/delegación);
--    la FK no debe arrastrar los votos si se recarga el padrón.
alter table votos alter column asambleista_id drop not null;
alter table votos drop constraint if exists votos_asambleista_id_fkey;
alter table votos add constraint votos_asambleista_id_fkey
  foreign key (asambleista_id) references asambleistas(id) on delete set null;

-- 4) Al quitar una asistencia, se retira su voto de la votación ABIERTA (si la hay).
--    Los votos de votaciones ya cerradas se conservan.
create or replace function votos_al_quitar_asistencia() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  delete from votos v
  using iniciativas i, asambleas a
  where v.iniciativa_id = i.id and a.id = i.asamblea_id
    and i.estado = 'abierta' and a.estado = 'activa'
    and v.asambleista_id = old.asambleista_id;
  return old;
end $$;
drop trigger if exists trg_votos_al_quitar_asistencia on asistencia;
create trigger trg_votos_al_quitar_asistencia
  after delete on asistencia for each row execute function votos_al_quitar_asistencia();

-- 5) cerrar_asamblea(): cierra votaciones abiertas ANTES de archivar y limpiar
--    (así el trigger anterior no borra votos al vaciar asistencia).
create or replace function cerrar_asamblea()
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_actual bigint; v_pres int;
begin
  if not is_admin() then
    raise exception 'No autorizado: se requiere un administrador.';
  end if;
  select id into v_actual from asambleas where estado = 'activa'
  order by fecha desc nulls last, id desc limit 1;
  if v_actual is null then
    raise exception 'No hay una asamblea abierta que cerrar.';
  end if;

  update iniciativas set estado = 'cerrada', cerrada_at = now()
  where asamblea_id = v_actual and estado = 'abierta';

  insert into historico_asistencia
    (asamblea_id, orden, nombre, colegiatura, cedula, delegacion, cargo, presente, hora, registrado_nombre)
  select v_actual, a.orden, a.nombre, a.colegiatura, a.cedula, a.delegacion, a.cargo,
         (asi.id is not null), asi.hora, asi.registrado_nombre
  from asambleistas a
  left join asistencia asi on asi.asambleista_id = a.id
  where not exists (select 1 from historico_asistencia h where h.asamblea_id = v_actual);

  select count(*) into v_pres from asistencia;
  update asambleas set estado = 'cerrada' where id = v_actual;
  delete from asistencia where id >= 0;
  return jsonb_build_object('cerrada_id', v_actual, 'archivados_presentes', v_pres);
end $$;
grant execute on function cerrar_asamblea() to authenticated;

-- 6) Endurecer: las funciones de staff no se exponen a anon (ya validan el rol
--    por dentro; esto sólo evita llamadas anónimas).
revoke execute on function abrir_iniciativa(text, text) from public, anon;
revoke execute on function cerrar_iniciativa(bigint) from public, anon;
revoke execute on function cerrar_asamblea() from public, anon;
revoke execute on function abrir_asamblea(text, date) from public, anon;
