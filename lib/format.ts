// Formateo de fecha/hora en horario local (República Dominicana en el
// navegador del operador). El timestamp viene en UTC desde Supabase.

export function horaLocal(iso: string): string {
  return new Date(iso).toLocaleTimeString("es-DO", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function fechaLocal(iso: string): string {
  return new Date(iso).toLocaleDateString("es-DO", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function fechaHoraLocal(iso: string): string {
  return `${fechaLocal(iso)} ${horaLocal(iso)}`;
}
