"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Download, Loader2, RefreshCw } from "lucide-react";
import { type AsambleistaConAsistencia } from "@/lib/types/database";

type Filtro = "todos" | "presentes" | "ausentes";

function horaLocal(iso: string) {
  return new Date(iso).toLocaleTimeString("es-DO", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function ReporteClient() {
  const supabase = createClient();
  const [rows, setRows] = useState<AsambleistaConAsistencia[]>([]);
  const [cargando, setCargando] = useState(true);
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [delegacion, setDelegacion] = useState("todas");
  const [busqueda, setBusqueda] = useState("");

  async function cargar() {
    setCargando(true);
    const { data } = await supabase
      .from("asambleistas")
      .select("*, asistencia(id,hora,registrado_nombre)")
      .order("orden");
    setRows((data as AsambleistaConAsistencia[]) ?? []);
    setCargando(false);
  }

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const delegaciones = useMemo(
    () => Array.from(new Set(rows.map((r) => r.delegacion))).sort(),
    [rows]
  );

  const presente = (r: AsambleistaConAsistencia) =>
    !!(r.asistencia && r.asistencia.length > 0);

  const filtradas = useMemo(() => {
    return rows.filter((r) => {
      if (delegacion !== "todas" && r.delegacion !== delegacion) return false;
      if (filtro === "presentes" && !presente(r)) return false;
      if (filtro === "ausentes" && presente(r)) return false;
      if (busqueda.trim()) {
        const t = busqueda.trim().toLowerCase();
        const d = busqueda.replace(/\D/g, "");
        const okTxt = r.nombre.toLowerCase().includes(t);
        const okNum =
          d.length > 0 &&
          (String(r.colegiatura).includes(d) || r.cedula_norm.includes(d));
        if (!okTxt && !okNum) return false;
      }
      return true;
    });
  }, [rows, delegacion, filtro, busqueda]);

  const totalPresentes = rows.filter(presente).length;
  const pct = rows.length ? Math.round((totalPresentes / rows.length) * 100) : 0;

  const resumen = useMemo(() => {
    const m = new Map<string, { total: number; pres: number }>();
    for (const r of rows) {
      const e = m.get(r.delegacion) ?? { total: 0, pres: 0 };
      e.total++;
      if (presente(r)) e.pres++;
      m.set(r.delegacion, e);
    }
    return Array.from(m.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [rows]);

  function exportarCSV() {
    const enc = (s: string | number | null) => {
      const v = s == null ? "" : String(s);
      return `"${v.replace(/"/g, '""')}"`;
    };
    const head = [
      "Orden",
      "Nombre",
      "Colegiatura",
      "Cedula",
      "Telefono",
      "Delegacion",
      "Plancha",
      "Cargo",
      "Presente",
      "Hora",
      "Registrado por",
    ];
    const lines = rows.map((r) => {
      const a = r.asistencia && r.asistencia.length > 0 ? r.asistencia[0] : null;
      return [
        r.orden,
        r.nombre,
        r.colegiatura,
        r.cedula,
        r.telefono,
        r.delegacion,
        r.plancha,
        r.cargo,
        a ? "SI" : "NO",
        a ? horaLocal(a.hora) : "",
        a?.registrado_nombre ?? "",
      ]
        .map(enc)
        .join(",");
    });
    const csv = "﻿" + [head.map(enc).join(","), ...lines].join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const fecha = new Date().toISOString().slice(0, 10);
    link.href = url;
    link.download = `asistencia_codia_${fecha}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  async function desmarcar(r: AsambleistaConAsistencia) {
    if (!confirm(`¿Quitar la asistencia de ${r.nombre}?`)) return;
    await supabase.from("asistencia").delete().eq("asambleista_id", r.id);
    await cargar();
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-codia-dark">Reporte de asistencia</h1>
          <p className="text-sm text-gray-500">
            {totalPresentes} de {rows.length} presentes ({pct}%)
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={cargar}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <RefreshCw size={16} /> Actualizar
          </button>
          <button
            onClick={exportarCSV}
            className="inline-flex items-center gap-2 rounded-lg bg-codia px-4 py-2 text-sm font-semibold text-white hover:bg-codia-dark"
          >
            <Download size={16} /> Exportar CSV
          </button>
        </div>
      </div>

      {/* Resumen por delegación */}
      <details className="mb-5 rounded-xl border border-gray-200 bg-white p-4">
        <summary className="cursor-pointer text-sm font-semibold text-codia-dark">
          Resumen por delegación / regional
        </summary>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {resumen.map(([d, e]) => (
            <div
              key={d}
              className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2 text-sm"
            >
              <span className="truncate pr-2 text-gray-700">{d}</span>
              <span className="shrink-0 font-semibold tabular-nums text-gray-900">
                {e.pres}/{e.total}
              </span>
            </div>
          ))}
        </div>
      </details>

      {/* Filtros */}
      <div className="mb-4 grid gap-2 sm:grid-cols-3">
        <input
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar nombre / número"
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-codia"
        />
        <select
          value={delegacion}
          onChange={(e) => setDelegacion(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-codia"
        >
          <option value="todas">Todas las delegaciones</option>
          {delegaciones.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
        <select
          value={filtro}
          onChange={(e) => setFiltro(e.target.value as Filtro)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-codia"
        >
          <option value="todos">Todos</option>
          <option value="presentes">Solo presentes</option>
          <option value="ausentes">Solo ausentes</option>
        </select>
      </div>

      {/* Tabla */}
      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 text-xs uppercase text-gray-500">
            <tr>
              <th className="px-3 py-2">Nombre</th>
              <th className="px-3 py-2">Coleg.</th>
              <th className="px-3 py-2 hidden md:table-cell">Delegación</th>
              <th className="px-3 py-2">Estado</th>
              <th className="px-3 py-2 hidden sm:table-cell">Hora</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {cargando ? (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-gray-400">
                  <Loader2 className="mx-auto animate-spin" />
                </td>
              </tr>
            ) : filtradas.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-gray-400">
                  Sin resultados
                </td>
              </tr>
            ) : (
              filtradas.map((r) => {
                const a =
                  r.asistencia && r.asistencia.length > 0 ? r.asistencia[0] : null;
                return (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2 font-medium text-gray-900">
                      {r.nombre}
                      <span className="block text-xs text-gray-400 md:hidden">
                        {r.delegacion}
                      </span>
                    </td>
                    <td className="px-3 py-2 tabular-nums text-gray-600">
                      {r.colegiatura}
                    </td>
                    <td className="px-3 py-2 hidden text-gray-600 md:table-cell">
                      {r.delegacion}
                    </td>
                    <td className="px-3 py-2">
                      {a ? (
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                          Presente
                        </span>
                      ) : (
                        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">
                          Ausente
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 hidden text-gray-500 sm:table-cell">
                      {a ? horaLocal(a.hora) : "—"}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {a && (
                        <button
                          onClick={() => desmarcar(r)}
                          className="text-xs font-medium text-red-500 hover:underline"
                        >
                          Quitar
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
