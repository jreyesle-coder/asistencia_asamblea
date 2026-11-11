-- =====================================================================
-- CODIA · Crear perfiles del personal de registro
-- IMPORTANTE: primero cree los usuarios en Supabase →
--   Authentication → Users → Add user (email + password, "Auto Confirm").
-- Luego edite los correos de abajo y ejecute este script.
-- =====================================================================

-- Administrador (ve el reporte, exporta CSV y puede quitar asistencias)
insert into profiles (id, nombre, rol)
select id, 'Administrador', 'admin'
from auth.users
where email = 'ADMIN@codia.org.do'
on conflict (id) do update
  set nombre = excluded.nombre, rol = excluded.rol, activo = true;

-- Registradores de mesa (solo buscan y marcan presente)
insert into profiles (id, nombre, rol)
select id, 'Registro Mesa 1', 'registrador'
from auth.users
where email = 'MESA1@codia.org.do'
on conflict (id) do update
  set nombre = excluded.nombre, rol = excluded.rol, activo = true;

-- Repita el bloque anterior por cada mesa/usuario adicional.

-- Presidente (somete iniciativas a votación; ve Reporte e Histórico). Requiere 0009.
insert into profiles (id, nombre, rol)
select id, 'Presidente', 'presidente'
from auth.users
where email = 'presidente@asamblea.app'
on conflict (id) do update
  set nombre = excluded.nombre, rol = excluded.rol, activo = true;

-- Tecnología (respaldo con acceso total: registro, reporte, abrir/cerrar
-- asamblea y votaciones). Requiere 0009.
insert into profiles (id, nombre, rol)
select id, 'Tecnología', 'tecnologia'
from auth.users
where email = 'tecnologia@asamblea.app'
on conflict (id) do update
  set nombre = excluded.nombre, rol = excluded.rol, activo = true;
