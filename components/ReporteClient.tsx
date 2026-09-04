"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Download, Loader2, Printer, RefreshCw } from "lucide-react";
import {
  type AsambleistaConAsistencia,
  primeraAsistencia,
} from "@/lib/types/database";
import { fechaLocal, horaLocal } from "@/lib/format";
import QuitarAsistenciaModal from "@/components/QuitarAsistenciaModal";

type Filtro = "todos" | "presentes" | "ausentes";

const presente = (r: AsambleistaConAsistencia) => !!primeraAsistencia(r);

export default function ReporteClient() {
  const supabase = createClient();
  const [rows, setRows] = useState<AsambleistaConAsistencia[]>([]);
  const [cargando, setCargando] = useState(true);
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [delegacion, setDelegacion] = useState("todas");
  const [busqueda, setBusqueda] = useState("");
  const [quitar, setQuitar] = useState<AsambleistaConAsistencia | null>(null);

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

  // Delegaciones en el ORDEN del Excel (primera aparición según "orden")
  const delegaciones = useMemo(() => {
    const seen: string[] = [];
    for (const r of rows) if (!seen.includes(r.delegacion)) seen.push(r.delegacion);
    return seen;
  }, [rows]);

  const totalPresentes = rows.filter(presente).length;
  const pct = rows.length ? Math.round((totalPresentes / rows.length) * 100) : 0;

  const coincide = (r: AsambleistaConAsistencia) => {
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
  };

  // Secciones por delegación (orden del Excel), con conteo total y filas filtradas
  const secciones = useMemo(() => {
    return delegaciones
      .filter((d) => delegacion === "todas" || d === delegacion)
      .map((d) => {
        const todas = rows.filter((r) => r.delegacion === d);
        return {
          delegacion: d,
          total: todas.length,
          presentes: todas.filter(presente).length,
          filas: todas.filter(coincide),
        };
      })
      .filter((s) => s.filas.length > 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, delegaciones, delegacion, filtro, busqueda]);

  function exportarCSV() {
    const enc = (s: string | number | null) => {
      const v = s == null ? "" : String(s);
      return `"${v.replace(/"/g, '""')}"`;
    };
    const head = [
      "Orden",
      "Delegacion / Regional",
      "Nombre",
      "Cargo",
      "Colegiatura",
      "Cedula",
      "Telefono",
      "Plancha",
      "Asistio",
      "Fecha",
      "Hora",
      "Registrado por",
    ];
    // Exporta respetando el orden del Excel
    const lines = rows.map((r) => {
      const a = primeraAsistencia(r);
      return [
        r.orden,
        r.delegacion,
        r.nombre,
        r.cargo,
        r.colegiatura,
        r.cedula,
        r.telefono,
        r.plancha,
        a ? "SI" : "NO",
        a ? fechaLocal(a.hora) : "",
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

  function imprimir() {
    document
      .querySelectorAll<HTMLDetailsElement>("details")
      .forEach((d) => (d.open = true));
    setTimeout(() => window.print(), 100);
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-6">
      {/* Encabezado solo para impresión */}
      <div className="mb-4 hidden print:block">
        <h1 className="text-lg font-bold">
          CODIA — Reporte de asistencia · Asamblea 2026-2027
        </h1>
        <p className="text-sm">
          {totalPresentes} de {rows.length} presentes ({pct}%) · Impreso:{" "}
          {new Date().toLocaleString("es-DO")}
        </p>
      </div>

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div>
          <h1 className="text-xl font-bold text-codia-dark">
            Reporte de asistencia
          </h1>
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
            onClick={imprimir}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <Printer size={16} /> Imprimir
          </button>
          <button
            onClick={exportarCSV}
            className="inline-flex items-center gap-2 rounded-lg bg-codia px-4 py-2 text-sm font-semibold text-white hover:bg-codia-dark"
          >
            <Download size={16} /> Exportar CSV
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div className="mb-5 grid gap-2 sm:grid-cols-3 print:hidden">
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

      {cargando ? (
        <div className="py-12 text-center text-gray-400">
          <Loader2 className="mx-auto animate-spin" />
        </div>
      ) : secciones.length === 0 ? (
        <p className="py-12 text-center text-gray-400">Sin resultados</p>
      ) : (
        <div className="space-y-4">
          {secciones.map((s) => (
            <details
              key={s.delegacion}
              open
              className="overflow-hidden rounded-xl border border-gray-200 bg-white"
            >
              <summary className="flex cursor-pointer items-center justify-between gap-2 bg-codia px-4 py-2.5 text-white">
                <span className="text-sm font-bold uppercase tracking-wide">
                  {s.delegacion}
                </span>
                <span className="shrink-0 rounded-full bg-white/15 px-2.5 py-0.5 text-xs font-semibold tabular-nums">
                  {s.presentes}/{s.total} presentes
                </span>
              </summary>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                    <tr>
                      <th className="px-3 py-2">Nombre</th>
                      <th className="px-3 py-2">Cargo</th>
                      <th className="px-3 py-2">Coleg.</th>
                      <th className="px-3 py-2 hidden sm:table-cell">Cédula</th>
                      <th className="px-3 py-2">Estado</th>
                      <th className="px-3 py-2 hidden md:table-cell">
                        Fecha y hora
                      </th>
                      <th className="px-3 py-2 print:hidden"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {s.filas.map((r) => {
                      const a = primeraAsistencia(r);
                      return (
                        <tr key={r.id} className="hover:bg-gray-50">
                          <td className="px-3 py-2 font-medium text-gray-900">
                            {r.nombre}
                          </td>
                          <td className="px-3 py-2 text-gray-600">
                            {r.cargo || "—"}
                          </td>
                          <td className="px-3 py-2 tabular-nums text-gray-600">
                            {r.colegiatura}
                          </td>
                          <td className="px-3 py-2 hidden text-gray-600 sm:table-cell">
                            {r.cedula}
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
                          <td className="px-3 py-2 hidden whitespace-nowrap text-gray-500 md:table-cell">
                            {a ? `${fechaLocal(a.hora)} ${horaLocal(a.hora)}` : "—"}
                          </td>
                          <td className="px-3 py-2 text-right print:hidden">
                            {a && (
                              <button
                                onClick={() => setQuitar(r)}
                                className="text-xs font-medium text-red-500 hover:underline"
                              >
                                Quitar
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </details>
          ))}
        </div>
      )}

      {quitar && (
        <QuitarAsistenciaModal
          asambleistaId={quitar.id}
          nombre={quitar.nombre}
          onClose={() => setQuitar(null)}
          onDone={cargar}
        />
      )}
    </main>
  );
}
