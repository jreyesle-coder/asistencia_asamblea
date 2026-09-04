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

export interface AsambleistaConAsistencia extends Asambleista {
  asistencia: Asistencia[] | null;
}
