-- =====================================================================
-- CODIA · Control de apertura (migración 0008)
-- Registrar asistencia SOLO es posible si hay una asamblea abierta (activa).
-- Cerrar ya NO abre otra automáticamente: queda sin asamblea abierta hasta
-- que un administrador abra una nueva. Ejecutar UNA vez en SQL Editor.
-- =====================================================================

-- 1) RLS: no se puede marcar asistencia si no hay asamblea abierta
drop policy if exists "staff marca asistencia" on asistencia;
create policy "staff marca asistencia" on asistencia
  for insert with check (
    is_staff() and exists (select 1 from asambleas where estado = 'activa')
  );

-- 2) Cerrar la asamblea activa (NO abre otra). Archiva + cierra + limpia.
drop function if exists cerrar_asamblea(text, date);
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

-- 3) Abrir una nueva asamblea (habilita el registro). Error si ya hay una abierta.
create or replace function abrir_asamblea(p_nombre text, p_fecha date)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_id bigint;
begin
  if not is_admin() then
    raise exception 'No autorizado: se requiere un administrador.';
  end if;
  if exists (select 1 from asambleas where estado = 'activa') then
    raise exception 'Ya hay una asamblea abierta. Ciérrala antes de abrir otra.';
  end if;
  insert into asambleas (nombre, fecha, estado)
  values (coalesce(nullif(trim(p_nombre), ''),
          'Asamblea ' || to_char(coalesce(p_fecha, current_date), 'DD/MM/YYYY')),
          p_fecha, 'activa')
  returning id into v_id;
  return jsonb_build_object('nueva_id', v_id);
end $$;
grant execute on function abrir_asamblea(text, date) to authenticated;

-- 4) Estado actual: eliminar la asamblea "placeholder" (sin fecha) para que
--    quede SIN asamblea abierta (registro bloqueado hasta abrir una nueva).
delete from asambleas where estado = 'activa' and fecha is null;
