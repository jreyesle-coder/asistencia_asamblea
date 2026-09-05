-- =====================================================================
-- CODIA · Habilita Supabase Realtime para la tabla asistencia
-- Con esto, cada marca/eliminación de asistencia se refleja al INSTANTE
-- en todos los usuarios logueados (registro y reporte).
-- Sin esto, la app igual se actualiza sola cada 5 s (polling de respaldo).
-- Ejecutar una sola vez en Supabase → SQL Editor.
-- =====================================================================

alter publication supabase_realtime add table asistencia;
