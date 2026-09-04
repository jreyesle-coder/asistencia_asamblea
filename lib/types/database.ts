export type Rol = "admin" | "registrador";

export interface Asambleista {
  id: number;
  orden: number;
  nombre: string;
  colegiatura: number;
  cedula: string;
  cedula_norm: string;
  telefono: string | null;
  delegacion: string;
  plancha: string | null;
  cargo: string | null;
}

export interface Asistencia {
  id: number;
  asambleista_id: number;
  hora: string;
  registrado_por: string | null;
  registrado_nombre: string | null;
}

// PostgREST devuelve el embed como OBJETO cuando la relación es uno-a-uno
// (asistencia.asambleista_id es UNIQUE), o como ARREGLO en otros casos.
// Manejamos ambos para evitar depender de esa heurística.
export type AsistenciaEmbed = Asistencia | Asistencia[] | null;

export interface AsambleistaConAsistencia extends Asambleista {
  asistencia: AsistenciaEmbed;
}

export function primeraAsistencia(
  a: AsambleistaConAsistencia
): Asistencia | null {
  const x = a.asistencia;
  if (!x) return null;
  return Array.isArray(x) ? x[0] ?? null : x;
}
