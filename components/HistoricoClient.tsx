"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Download, Loader2, Printer } from "lucide-react";
import { type Asamblea, type HistoricoRow } from "@/lib/types/database";
import { fechaLocal, horaLocal } from "@/lib/format";

export default function HistoricoClient() {
  const supabase = useMemo(() => createClient(), []);
  const [asambleas, setAsambleas] = useState<Asamblea[]>([]);
  const [selId, setSelId] = useState<number | null>(null);
  const [rows, setRows] = useState<HistoricoRow[]>([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("asambleas")
        .select("*")
        .order("fecha", { ascending: false });
      const list = (data as Asamblea[]) ?? [];
      setAsambleas(list);
      const cerrada = list.find((a) => a.estado === "cerrada") ?? list[0];
      setSelId(cerrada?.id ?? null);
      setCargando(false);
    })();
  }, [supabase]);

  const cargarRows = useCallback(
    async (id: number) => {
      const { data } = await supabase
        .from("historico_asistencia")
        .select("*")
        .eq("asamblea_id", id)
        .order("orden");
      setRows((data as HistoricoRow[]) ?? []);
    },
    [supabase]
  );

  useEffect(() => {
    if (selId != null) cargarRows(selId);
  }, [selId, cargarRows]);

  const asambleaSel = asambleas.find((a) => a.id === selId) ?? null;
  const totalPresentes = rows.filter((r) => r.presente).length;
  const pct = rows.length ? Math.round((totalPresentes / rows.length) * 100) : 0;

  const secciones = useMemo(() => {
    const orden: string[] = [];
    for (const r of rows) {
      const d = r.delegacion ?? "—";
      if (!orden.includes(d)) orden.push(d);
    }
    return orden.map((d) => {
      const filas = rows.filter((r) => (r.delegacion ?? "—") === d);
      return {
        delegacion: d,
        total: filas.length,
        presentes: filas.filter((r) => r.presente).length,
        filas,
      };
    });
  }, [rows]);

  function exportarCSV() {
    const enc = (s: string | number | null) =>
      `"${(s == null ? "" : String(s)).replace(/"/g, '""')}"`;
    const head = [
      "Orden",
      "Delegacion / Regional",
      "Nombre",
      "Cargo",
      "Colegiatura",
      "Cedula",
      "Asistio",
      "Fecha",
      "Hora",
      "Registrado por",
    ];
    const lines = rows.map((r) =>
      [
        r.orden,
        r.delegacion,
        r.nombre,
        r.cargo,
        r.colegiatura,
        r.cedula,
        r.presente ? "SI" : "NO",
        r.hora ? fechaLocal(r.hora) : "",
        r.hora ? horaLocal(r.hora) : "",
        r.registrado_nombre ?? "",
      ]
        .map(enc)
        .join(",")
    );
    const csv = "﻿" + [head.map(enc).join(","), ...lines].join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `historico_${(asambleaSel?.nombre ?? "asamblea").replace(/[^\w]+/g, "_")}.csv`;
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
          CODIA — Histórico de asistencia
          {asambleaSel ? ` · ${asambleaSel.nombre}` : ""}
        </h1>
        <p className="text-sm">
          {totalPresentes} de {rows.length} presentes ({pct}%)
        </p>
      </div>

      <div className="mb-5 flex flex-wrap items-end justify-between gap-3 print:hidden">
        <div>
          <h1 className="text-xl font-bold text-codia-dark">
            Histórico de asambleas
          </h1>
          <label className="mt-2 block text-xs font-medium text-gray-500">
            Asamblea
          </label>
          <select
            value={selId ?? ""}
            onChange={(e) => setSelId(Number(e.target.value))}
            className="mt-1 rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-codia"
          >
            {asambleas.map((a) => (
              <option key={a.id} value={a.id}>
                {a.nombre}
                {a.estado === "activa" ? " (en curso)" : ""}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-3">
          {asambleaSel && (
            <span className="text-sm text-gray-500">
              {totalPresentes} de {rows.length} presentes ({pct}%)
            </span>
          )}
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

      {cargando ? (
        <div className="py-12 text-center text-gray-400">
          <Loader2 className="mx-auto animate-spin" />
        </div>
      ) : rows.length === 0 ? (
        <p className="py-12 text-center text-gray-400">
          Esta asamblea aún no tiene un histórico congelado (solo las asambleas
          cerradas se archivan aquí).
        </p>
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
                      <th className="px-3 py-2 hidden md:table-cell">Registró</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {s.filas.map((r) => (
                      <tr key={r.id} className="hover:bg-gray-50">
                        <td className="px-3 py-2 font-medium text-gray-900">
                          {r.nombre}
                        </td>
                        <td className="px-3 py-2 text-gray-600">
                          {r.cargo || "—"}
                        </td>
                        <td className="px-3 py-2 tabular-nums text-gray-600">
                          {r.colegiatura ?? "—"}
                        </td>
                        <td className="px-3 py-2 hidden text-gray-600 sm:table-cell">
                          {r.cedula ?? "—"}
                        </td>
                        <td className="px-3 py-2">
                          {r.presente ? (
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
                          {r.hora ? `${fechaLocal(r.hora)} ${horaLocal(r.hora)}` : "—"}
                        </td>
                        <td className="px-3 py-2 hidden text-gray-600 md:table-cell">
                          {r.registrado_nombre ?? "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          ))}
        </div>
      )}
    </main>
  );
}
