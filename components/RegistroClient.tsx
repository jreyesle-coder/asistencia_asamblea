"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  Search,
  CheckCircle2,
  Loader2,
  UserCheck,
  X,
  BadgeCheck,
} from "lucide-react";
import { type AsambleistaConAsistencia, type Rol } from "@/lib/types/database";

function horaLocal(iso: string) {
  return new Date(iso).toLocaleTimeString("es-DO", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function RegistroClient({
  rol,
  nombreUsuario,
}: {
  rol: Rol;
  nombreUsuario: string;
}) {
  const supabase = createClient();
  const [q, setQ] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [resultados, setResultados] = useState<AsambleistaConAsistencia[] | null>(
    null
  );
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [marcandoId, setMarcandoId] = useState<number | null>(null);
  const [total, setTotal] = useState(0);
  const [presentes, setPresentes] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const cargarConteos = useCallback(async () => {
    const [{ count: t }, { count: p }] = await Promise.all([
      supabase.from("asambleistas").select("*", { count: "exact", head: true }),
      supabase.from("asistencia").select("*", { count: "exact", head: true }),
    ]);
    setTotal(t ?? 0);
    setPresentes(p ?? 0);
  }, [supabase]);

  useEffect(() => {
    cargarConteos();
    const id = setInterval(cargarConteos, 20000);
    inputRef.current?.focus();
    return () => clearInterval(id);
  }, [cargarConteos]);

  async function buscar(e?: React.FormEvent) {
    e?.preventDefault();
    const term = q.trim();
    if (!term) return;
    setBuscando(true);
    setMensaje(null);
    setResultados(null);

    const digits = term.replace(/\D/g, "");
    let query = supabase
      .from("asambleistas")
      .select("*, asistencia(id,hora,registrado_nombre)")
      .order("orden");

    if (digits.length >= 7) {
      query = query.eq("cedula_norm", digits);
    } else if (digits.length > 0) {
      query = query.eq("colegiatura", Number(digits));
    } else {
      query = query.ilike("nombre", `%${term}%`).limit(20);
    }

    const { data, error } = await query;
    setBuscando(false);

    if (error) {
      setMensaje("Error al consultar. Revise la conexión.");
      return;
    }
    if (!data || data.length === 0) {
      setMensaje(
        "No se encontró ningún asambleísta con ese dato. Verifique el número."
      );
      return;
    }
    setResultados(data as AsambleistaConAsistencia[]);
  }

  async function marcar(a: AsambleistaConAsistencia) {
    setMarcandoId(a.id);
    const { error } = await supabase.from("asistencia").insert({
      asambleista_id: a.id,
      registrado_nombre: nombreUsuario,
    });
    setMarcandoId(null);
    if (error) {
      // 23505 = ya existe (marcado por otra estación)
      setMensaje("No se pudo marcar. Es posible que ya esté registrado.");
    }
    await Promise.all([buscar(), cargarConteos()]);
  }

  async function desmarcar(a: AsambleistaConAsistencia) {
    if (!confirm(`¿Quitar la asistencia de ${a.nombre}?`)) return;
    setMarcandoId(a.id);
    await supabase.from("asistencia").delete().eq("asambleista_id", a.id);
    setMarcandoId(null);
    await Promise.all([buscar(), cargarConteos()]);
  }

  function limpiar() {
    setQ("");
    setResultados(null);
    setMensaje(null);
    inputRef.current?.focus();
  }

  const pct = total ? Math.round((presentes / total) * 100) : 0;

  return (
    <main className="mx-auto max-w-4xl px-4 py-6">
      {/* Contador en vivo */}
      <div className="mb-6 grid grid-cols-3 gap-3">
        <Stat label="Presentes" value={presentes} accent="text-emerald-600" />
        <Stat label="Faltan" value={Math.max(total - presentes, 0)} accent="text-gray-500" />
        <Stat label="% asistencia" value={`${pct}%`} accent="text-codia" />
      </div>

      {/* Buscador */}
      <form onSubmit={buscar} className="mb-4">
        <label className="mb-1.5 block text-sm font-medium text-gray-700">
          Número de colegiatura, cédula o nombre
        </label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search
              size={18}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            />
            <input
              ref={inputRef}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              inputMode="text"
              className="w-full rounded-lg border border-gray-300 py-3 pl-10 pr-9 outline-none focus:border-codia focus:ring-2 focus:ring-codia/20"
              placeholder="Ej. 34129  ó  025-0039280-4"
            />
            {q && (
              <button
                type="button"
                onClick={limpiar}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-gray-400 hover:bg-gray-100"
                aria-label="Limpiar"
              >
                <X size={18} />
              </button>
            )}
          </div>
          <button
            type="submit"
            disabled={buscando}
            className="flex items-center gap-2 rounded-lg bg-codia px-5 font-semibold text-white transition hover:bg-codia-dark disabled:opacity-60"
          >
            {buscando ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <Search size={18} />
            )}
            <span className="hidden sm:inline">Buscar</span>
          </button>
        </div>
      </form>

      {mensaje && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {mensaje}
        </div>
      )}

      {/* Resultados */}
      <div className="space-y-3">
        {resultados?.map((a) => {
          const asis = a.asistencia && a.asistencia.length > 0 ? a.asistencia[0] : null;
          const presente = !!asis;
          return (
            <div
              key={a.id}
              className={`rounded-xl border bg-white p-4 shadow-sm transition ${
                presente ? "border-emerald-300" : "border-gray-200"
              }`}
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="truncate text-lg font-bold text-codia-dark">
                    {a.nombre}
                  </p>
                  <p className="text-sm text-gray-600">{a.delegacion}</p>
                  <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-gray-500">
                    <span>Colegiatura: <b className="text-gray-700">{a.colegiatura}</b></span>
                    <span>Cédula: <b className="text-gray-700">{a.cedula}</b></span>
                    {a.cargo && <span>Cargo: <b className="text-gray-700">{a.cargo}</b></span>}
                    {a.plancha && <span>Plancha: <b className="text-gray-700">{a.plancha}</b></span>}
                  </div>
                </div>

                <div className="shrink-0">
                  {presente ? (
                    <div className="flex flex-col items-start gap-2 sm:items-end">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1.5 text-sm font-semibold text-emerald-700">
                        <BadgeCheck size={18} /> Registrado
                      </span>
                      <span className="text-xs text-gray-500">
                        {horaLocal(asis!.hora)}
                        {asis!.registrado_nombre ? ` · ${asis!.registrado_nombre}` : ""}
                      </span>
                      {rol === "admin" && (
                        <button
                          onClick={() => desmarcar(a)}
                          disabled={marcandoId === a.id}
                          className="text-xs font-medium text-red-500 hover:underline"
                        >
                          Quitar asistencia
                        </button>
                      )}
                    </div>
                  ) : (
                    <button
                      onClick={() => marcar(a)}
                      disabled={marcandoId === a.id}
                      className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-5 py-3 font-bold text-white transition hover:bg-emerald-700 disabled:opacity-60 sm:w-auto"
                    >
                      {marcandoId === a.id ? (
                        <Loader2 size={20} className="animate-spin" />
                      ) : (
                        <UserCheck size={20} />
                      )}
                      Marcar Presente
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {resultados && resultados.length > 1 && (
        <p className="mt-3 text-center text-xs text-gray-400">
          {resultados.length} coincidencias — seleccione la persona correcta.
        </p>
      )}
    </main>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string | number;
  accent: string;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-3 text-center shadow-sm">
      <p className={`text-2xl font-extrabold tabular-nums ${accent}`}>{value}</p>
      <p className="text-xs text-gray-500">{label}</p>
    </div>
  );
}
