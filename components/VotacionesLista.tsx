"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { type Iniciativa, type Voto, type OpcionVoto } from "@/lib/types/database";
import { fechaLocal, horaLocal } from "@/lib/format";

export const LABELS_VOTO: Record<OpcionVoto, string> = {
  favor: "A favor",
  contra: "En contra",
  abstencion: "Abstención",
};

export function conteoVotos(vs: Voto[]) {
  return {
    favor: vs.filter((v) => v.opcion === "favor").length,
    contra: vs.filter((v) => v.opcion === "contra").length,
    abstencion: vs.filter((v) => v.opcion === "abstencion").length,
    total: vs.length,
  };
}

// CSV nominal de una votación: encabezado con el resumen + una fila por voto.
export function exportarVotacionCSV(ini: Iniciativa, vs: Voto[]) {
  const enc = (s: string | number | null | undefined) =>
    `"${(s == null ? "" : String(s)).replace(/"/g, '""')}"`;
  const c = conteoVotos(vs);
  const resumen = [
    ["Iniciativa", ini.titulo],
    ["Descripcion", ini.descripcion ?? ""],
    ["Abierta", ini.abierta_at ? `${fechaLocal(ini.abierta_at)} ${horaLocal(ini.abierta_at)}` : ""],
    ["Cerrada", ini.cerrada_at ? `${fechaLocal(ini.cerrada_at)} ${horaLocal(ini.cerrada_at)}` : ""],
    ["A favor", c.favor],
    ["En contra", c.contra],
    ["Abstencion", c.abstencion],
    ["Total votos", c.total],
    [],
  ].map((r) => r.map(enc).join(","));
  const head = ["Nombre", "Colegiatura", "Delegacion", "Voto", "Fecha", "Hora"];
  const lines = vs.map((v) =>
    [
      v.asambleista_nombre,
      v.colegiatura,
      v.delegacion,
      LABELS_VOTO[v.opcion],
      v.hora ? fechaLocal(v.hora) : "",
      v.hora ? horaLocal(v.hora) : "",
    ]
      .map(enc)
      .join(",")
  );
  const csv = "﻿" + [...resumen, head.map(enc).join(","), ...lines].join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  // Conserva letras acentuadas y ñ en el nombre del archivo
  a.download = `votacion_${ini.id}_${ini.titulo.replace(/[^\p{L}\p{N}]+/gu, "_").slice(0, 30)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Lista de votaciones con totales, detalle nominal y exportación CSV.
export default function VotacionesLista({
  iniciativas,
  votos,
  titulo = "Votaciones cerradas",
}: {
  iniciativas: Iniciativa[];
  votos: Record<number, Voto[]>;
  titulo?: string;
}) {
  const [verDetalle, setVerDetalle] = useState<number | null>(null);
  if (iniciativas.length === 0) return null;

  return (
    <div>
      <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-gray-500">
        {titulo}
      </h2>
      <div className="space-y-3">
        {iniciativas.map((ini) => {
          const vs = votos[ini.id] ?? [];
          const c = conteoVotos(vs);
          const abiertoDet = verDetalle === ini.id;
          return (
            <div
              key={ini.id}
              className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-semibold text-codia-dark">{ini.titulo}</p>
                  <p className="text-xs text-gray-500">
                    A favor {c.favor} · En contra {c.contra} · Abstención{" "}
                    {c.abstencion} · {c.total} votos
                    {ini.cerrada_at ? ` · cerrada ${horaLocal(ini.cerrada_at)}` : ""}
                  </p>
                </div>
                <div className="flex gap-2 print:hidden">
                  <button
                    onClick={() => setVerDetalle(abiertoDet ? null : ini.id)}
                    className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                  >
                    {abiertoDet ? "Ocultar" : "Ver detalle"}
                  </button>
                  <button
                    onClick={() => exportarVotacionCSV(ini, vs)}
                    className="inline-flex items-center gap-1 rounded-lg bg-codia px-3 py-1.5 text-xs font-semibold text-white hover:bg-codia-dark"
                  >
                    <Download size={14} /> CSV
                  </button>
                </div>
              </div>
              {abiertoDet && (
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                      <tr>
                        <th className="px-3 py-2">Nombre</th>
                        <th className="px-3 py-2">Coleg.</th>
                        <th className="px-3 py-2">Voto</th>
                        <th className="px-3 py-2 hidden sm:table-cell">Hora</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {vs.map((v) => (
                        <tr key={v.id}>
                          <td className="px-3 py-2 text-gray-900">{v.asambleista_nombre}</td>
                          <td className="px-3 py-2 tabular-nums text-gray-600">{v.colegiatura}</td>
                          <td className="px-3 py-2 font-medium">{LABELS_VOTO[v.opcion]}</td>
                          <td className="px-3 py-2 hidden text-gray-500 sm:table-cell">
                            {v.hora ? horaLocal(v.hora) : ""}
                          </td>
                        </tr>
                      ))}
                      {vs.length === 0 && (
                        <tr>
                          <td colSpan={4} className="px-3 py-3 text-center text-gray-400">
                            Sin votos
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
