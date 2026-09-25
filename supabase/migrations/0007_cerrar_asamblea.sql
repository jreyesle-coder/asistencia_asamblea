-- =====================================================================
-- CODIA · Función para CERRAR la asamblea activa (migración 0007)
-- Archiva la asamblea activa al histórico, la marca cerrada, abre una
-- nueva asamblea activa y deja la asistencia en 0 — todo en una sola
-- transacción. Solo un administrador puede ejecutarla.
-- Ejecutar UNA vez en Supabase → SQL Editor. Luego el botón "Cerrar
-- asamblea" de la app la usa; no hace falta más SQL para cerrar asambleas.
-- =====================================================================

create or replace function cerrar_asamblea(p_nombre text, p_fecha date)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actual   bigint;
  v_presentes int;
  v_nueva    bigint;
begin
  if not is_admin() then
    raise exception 'No autorizado: se requiere un administrador.';
  end if;

  select id into v_actual
  from asambleas where estado = 'activa'
  order by fecha desc nulls last, id desc
  limit 1;

  if v_actual is null then
    raise exception 'No hay una asamblea activa que cerrar.';
  end if;

  -- Snapshot del roster + asistencia de la asamblea activa (si no fue archivada)
  insert into historico_asistencia
    (asamblea_id, orden, nombre, colegiatura, cedula, delegacion, cargo, presente, hora, registrado_nombre)
  select v_actual, a.orden, a.nombre, a.colegiatura, a.cedula, a.delegacion, a.cargo,
         (asi.id is not null), asi.hora, asi.registrado_nombre
  from asambleistas a
  left join asistencia asi on asi.asambleista_id = a.id
  where not exists (
    select 1 from historico_asistencia h where h.asamblea_id = v_actual
  );

  select count(*) into v_presentes from asistencia;

  -- Cerrar la actual y abrir la nueva
  update asambleas set estado = 'cerrada' where id = v_actual;
  insert into asambleas (nombre, fecha, estado)
  values (coalesce(nullif(trim(p_nombre), ''), 'Asamblea ' || to_char(coalesce(p_fecha, current_date), 'DD/MM/YYYY')),
          p_fecha, 'activa')
  returning id into v_nueva;

  -- Limpiar asistencia para la nueva asamblea
  delete from asistencia where id >= 0;

  return jsonb_build_object(
    'cerrada_id', v_actual,
    'archivados_presentes', v_presentes,
    'nueva_id', v_nueva
  );
end $$;

grant execute on function cerrar_asamblea(text, date) to authenticated;
