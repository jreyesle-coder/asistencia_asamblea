"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { createClient } from "@/lib/supabase/client";
import { Loader2, Plus, Square, Download, Users } from "lucide-react";
import { type Iniciativa, type Voto, type OpcionVoto } from "@/lib/types/database";
import { fechaLocal, horaLocal } from "@/lib/format";

const LABELS: Record<OpcionVoto, string> = {
  favor: "A favor",
  contra: "En contra",
  abstencion: "Abstención",
};

export default function VotacionControlClient({
  asambleaId,
  asambleaNombre,
}: {
  asambleaId: number | null;
  asambleaNombre: string | null;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [iniciativas, setIniciativas] = useState<Iniciativa[]>([]);
  const [votos, setVotos] = useState<Voto[]>([]);
  const [presentes, setPresentes] = useState(0);
  const [cargando, setCargando] = useState(true);
  const [titulo, setTitulo] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [trabajando, setTrabajando] = useState(false);
  const [verDetalle, setVerDetalle] = useState<number | null>(null);
  const [origin, setOrigin] = useState("");

  useEffect(() => setOrigin(window.location.origin), []);

  const cargar = useCallback(async () => {
    if (!asambleaId) {
      setCargando(false);
      return;
    }
    const [{ data: inis }, { count }] = await Promise.all([
      supabase
        .from("iniciativas")
        .select("*")
        .eq("asamblea_id", asambleaId)
        .order("id", { ascending: false }),
      supabase.from("asistencia").select("*", { count: "exact", head: true }),
    ]);
    const lista = (inis as Iniciativa[]) ?? [];
    setIniciativas(lista);
    setPresentes(count ?? 0);
    if (lista.length) {
      const { data: vs } = await supabase
        .from("votos")
        .select("*")
        .in(
          "iniciativa_id",
          lista.map((i) => i.id)
        );
      setVotos((vs as Voto[]) ?? []);
    } else {
      setVotos([]);
    }
    setCargando(false);
  }, [supabase, asambleaId]);

  useEffect(() => {
    cargar();
    const id = setInterval(cargar, 3000);
    return () => clearInterval(id);
  }, [cargar]);

  const abierta = iniciativas.find((i) => i.estado === "abierta") ?? null;
  const cerradas = iniciativas.filter((i) => i.estado === "cerrada");

  function conteo(iniId: number) {
    const vs = votos.filter((v) => v.iniciativa_id === iniId);
    return {
      favor: vs.filter((v) => v.opcion === "favor").length,
      contra: vs.filter((v) => v.opcion === "contra").length,
      abstencion: vs.filter((v) => v.opcion === "abstencion").length,
      total: vs.length,
    };
  }

  async function abrir(e: React.FormEvent) {
    e.preventDefault();
    if (!titulo.trim()) return;
    setError(null);
    setTrabajando(true);
    const { error } = await supabase.rpc("abrir_iniciativa", {
      p_titulo: titulo.trim(),
      p_descripcion: descripcion.trim(),
    });
    setTrabajando(false);
    if (error) {
      setError(
        error.message?.includes("Ya hay")
          ? "Ya hay una votación abierta. Ciérrala antes de abrir otra."
          : error.message?.includes("autoriz")
          ? "No autorizado."
          : error.message?.includes("asamblea")
          ? "No hay una asamblea abierta."
          : "No se pudo abrir la votación."
      );
      return;
    }
    setTitulo("");
    setDescripcion("");
    cargar();
  }

  async function cerrar(id: number) {
    if (!confirm("¿Cerrar esta votación? Ya no se aceptarán más votos.")) return;
    setTrabajando(true);
    await supabase.rpc("cerrar_iniciativa", { p_id: id });
    setTrabajando(false);
    cargar();
  }

  function exportarCSV(ini: Iniciativa) {
    const enc = (s: string | number | null) =>
      `"${(s == null ? "" : String(s)).replace(/"/g, '""')}"`;
    const head = ["Nombre", "Colegiatura", "Delegacion", "Voto", "Fecha", "Hora"];
    const vs = votos.filter((v) => v.iniciativa_id === ini.id);
    const lines = vs.map((v) =>
      [
        v.asambleista_nombre,
        v.colegiatura,
        v.delegacion,
        LABELS[v.opcion],
        v.hora ? fechaLocal(v.hora) : "",
        v.hora ? horaLocal(v.hora) : "",
      ]
        .map(enc)
        .join(",")
    );
    const csv = "﻿" + [head.map(enc).join(","), ...lines].join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `votacion_${ini.id}_${ini.titulo.replace(/[^\w]+/g, "_").slice(0, 30)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  if (!asambleaId) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-16 text-center">
        <p className="text-lg font-semibold text-codia-dark">
          No hay una asamblea abierta
        </p>
        <p className="mt-2 text-sm text-gray-600">
          Un administrador debe abrir la asamblea antes de poder someter
          iniciativas a votación.
        </p>
      </main>
    );
  }

  const Tally = ({ iniId }: { iniId: number }) => {
    const c = conteo(iniId);
    const faltan = Math.max(presentes - c.total, 0);
    const barra = (n: number, cls: string) => (
      <div className="h-2 rounded bg-gray-100">
        <div
          className={`h-2 rounded ${cls}`}
          style={{ width: `${c.total ? (n / c.total) * 100 : 0}%` }}
        />
      </div>
    );
    return (
      <div className="space-y-2">
        <div className="grid grid-cols-3 gap-3 text-center">
          <div>
            <p className="text-2xl font-extrabold text-emerald-600">{c.favor}</p>
            <p className="text-xs text-gray-500">A favor</p>
          </div>
          <div>
            <p className="text-2xl font-extrabold text-red-600">{c.contra}</p>
            <p className="text-xs text-gray-500">En contra</p>
          </div>
          <div>
            <p className="text-2xl font-extrabold text-gray-500">{c.abstencion}</p>
            <p className="text-xs text-gray-500">Abstención</p>
          </div>
        </div>
        <div className="space-y-1">
          {barra(c.favor, "bg-emerald-500")}
          {barra(c.contra, "bg-red-500")}
          {barra(c.abstencion, "bg-gray-400")}
        </div>
        <p className="text-center text-xs text-gray-500">
          {c.total} votos emitidos · {faltan} sin votar · {presentes} presentes
        </p>
      </div>
    );
  };

  return (
    <main className="mx-auto max-w-5xl px-4 py-6">
      <div className="mb-5">
        <h1 className="text-xl font-bold text-codia-dark">Votaciones</h1>
        <p className="flex items-center gap-1.5 text-sm text-gray-500">
          <Users size={14} /> {asambleaNombre} · {presentes} presentes
          <span className="ml-2 inline-flex items-center gap-1 text-xs text-gray-400">
            <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
            en vivo
          </span>
        </p>
      </div>

      {abierta ? (
        <div className="mb-6 grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-emerald-300 bg-white p-6 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600">
              Votación abierta
            </p>
            <h2 className="mt-1 text-lg font-bold text-codia-dark">
              {abierta.titulo}
            </h2>
            {abierta.descripcion && (
              <p className="mt-1 text-sm text-gray-600">{abierta.descripcion}</p>
            )}
            <div className="mt-5">
              <Tally iniId={abierta.id} />
            </div>
            <button
              onClick={() => cerrar(abierta.id)}
              disabled={trabajando}
              className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-amber-600 py-3 font-semibold text-white hover:bg-amber-700 disabled:opacity-60"
            >
              <Square size={18} /> Cerrar votación
            </button>
          </div>
          <div className="flex flex-col items-center justify-center rounded-2xl border border-gray-200 bg-white p-6 text-center shadow-sm">
            <p className="mb-3 text-sm font-semibold text-codia-dark">
              Escanea para votar
            </p>
            {origin && (
              <QRCodeSVG value={`${origin}/votar`} size={220} level="M" includeMargin />
            )}
            <p className="mt-3 text-xs text-gray-500">
              Los asambleístas registrados votan desde su teléfono. Si cerraron
              la página, escanean de nuevo y entran ya identificados.
            </p>
          </div>
        </div>
      ) : (
        <form
          onSubmit={abrir}
          className="mb-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm"
        >
          <h2 className="text-lg font-bold text-codia-dark">
            Someter una iniciativa a votación
          </h2>
          <div className="mt-4 space-y-3">
            <input
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Iniciativa / pregunta a votar"
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 outline-none focus:border-codia"
              required
            />
            <textarea
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Descripción (opcional)"
              rows={2}
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 outline-none focus:border-codia"
            />
            {error && (
              <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={trabajando || !titulo.trim()}
              className="inline-flex items-center gap-2 rounded-lg bg-codia px-5 py-2.5 font-semibold text-white hover:bg-codia-dark disabled:opacity-60"
            >
              {trabajando ? (
                <Loader2 className="animate-spin" size={18} />
              ) : (
                <Plus size={18} />
              )}
              Abrir votación
            </button>
          </div>
        </form>
      )}

      {/* Historial de votaciones de esta asamblea */}
      {cerradas.length > 0 && (
        <div>
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-gray-500">
            Votaciones cerradas
          </h2>
          <div className="space-y-3">
            {cerradas.map((ini) => {
              const c = conteo(ini.id);
              const abiertoDet = verDetalle === ini.id;
              const vs = votos.filter((v) => v.iniciativa_id === ini.id);
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
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() =>
                          setVerDetalle(abiertoDet ? null : ini.id)
                        }
                        className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                      >
                        {abiertoDet ? "Ocultar" : "Ver detalle"}
                      </button>
                      <button
                        onClick={() => exportarCSV(ini)}
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
                              <td className="px-3 py-2 text-gray-900">
                                {v.asambleista_nombre}
                              </td>
                              <td className="px-3 py-2 tabular-nums text-gray-600">
                                {v.colegiatura}
                              </td>
                              <td className="px-3 py-2 font-medium">
                                {LABELS[v.opcion]}
                              </td>
                              <td className="px-3 py-2 hidden text-gray-500 sm:table-cell">
                                {v.hora ? horaLocal(v.hora) : ""}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </main>
  );
}
