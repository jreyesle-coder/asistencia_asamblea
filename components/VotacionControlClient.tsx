"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import { createClient } from "@/lib/supabase/client";
import { Loader2, Plus, Square, Users, AlertTriangle } from "lucide-react";
import { type Iniciativa, type Voto } from "@/lib/types/database";
import VotacionesLista, { conteoVotos } from "@/components/VotacionesLista";

export default function VotacionControlClient({
  asambleaId,
  asambleaNombre,
}: {
  asambleaId: number | null;
  asambleaNombre: string | null;
}) {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  // Un solo router.refresh() cuando otro equipo abre/cierra la asamblea
  const refrescandoRef = useRef(false);
  useEffect(() => {
    refrescandoRef.current = false;
  }, [asambleaId]);
  const [iniciativas, setIniciativas] = useState<Iniciativa[]>([]);
  // votos por iniciativa; las cerradas se consultan una sola vez (ya no cambian)
  const [votos, setVotos] = useState<Record<number, Voto[]>>({});
  const cacheCerradas = useRef<Record<number, Voto[]>>({});
  const [presentes, setPresentes] = useState(0);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);
  const [titulo, setTitulo] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [trabajando, setTrabajando] = useState(false);
  const [origin, setOrigin] = useState("");

  useEffect(() => setOrigin(window.location.origin), []);

  const cargar = useCallback(async () => {
    // ¿Sigue siendo ésta la asamblea activa? Si otro equipo la abrió o cerró,
    // recargamos el estado del servidor (mismo patrón que Registro/Reporte).
    const { data: act, error: eAct } = await supabase
      .from("asambleas")
      .select("id")
      .eq("estado", "activa")
      .limit(1);
    if (!eAct) {
      const activaId = (act?.[0] as { id: number } | undefined)?.id ?? null;
      if (activaId !== asambleaId && !refrescandoRef.current) {
        refrescandoRef.current = true;
        router.refresh();
      }
    }
    if (!asambleaId) {
      setCargando(false);
      return;
    }
    const [{ data: inis, error: e1 }, { count, error: e2 }] = await Promise.all([
      supabase
        .from("iniciativas")
        .select("*")
        .eq("asamblea_id", asambleaId)
        .order("id", { ascending: false }),
      supabase.from("asistencia").select("*", { count: "exact", head: true }),
    ]);
    if (e1 || e2) {
      setErrorCarga("Sin conexión con la base de datos; reintentando…");
      setCargando(false);
      return;
    }
    const lista = (inis as Iniciativa[]) ?? [];
    // Una consulta por iniciativa (≤ presentes filas cada una): evita el tope
    // de 1000 filas de PostgREST cuando se acumulan muchas votaciones.
    const pendientes = lista.filter(
      (i) => i.estado === "abierta" || !cacheCerradas.current[i.id]
    );
    const res = await Promise.all(
      pendientes.map((i) =>
        supabase.from("votos").select("*").eq("iniciativa_id", i.id).order("hora")
      )
    );
    setVotos((prev) => {
      const n: Record<number, Voto[]> = { ...prev, ...cacheCerradas.current };
      pendientes.forEach((i, k) => {
        const r = res[k];
        if (r.error) return; // conserva lo anterior
        const vs = (r.data as Voto[]) ?? [];
        n[i.id] = vs;
        if (i.estado === "cerrada") cacheCerradas.current[i.id] = vs;
      });
      return n;
    });
    setIniciativas(lista);
    setPresentes(count ?? 0);
    setErrorCarga(null);
    setCargando(false);
  }, [supabase, asambleaId, router]);

  useEffect(() => {
    cargar();
    const id = setInterval(cargar, 3000);
    return () => clearInterval(id);
  }, [cargar]);

  const abierta = iniciativas.find((i) => i.estado === "abierta") ?? null;
  const cerradas = iniciativas.filter((i) => i.estado === "cerrada");

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
        error.message?.includes("Ya hay") || error.code === "23505"
          ? "Ya hay una votación abierta. Ciérrala antes de abrir otra."
          : error.message?.includes("autoriz")
          ? "No autorizado: solo el presidente (o tecnología) puede abrir votaciones."
          : error.message?.includes("asamblea")
          ? "No hay una asamblea abierta."
          : `No se pudo abrir la votación: ${error.message}`
      );
      return;
    }
    setTitulo("");
    setDescripcion("");
    cargar();
  }

  async function cerrar(id: number) {
    if (!confirm("¿Cerrar esta votación? Ya no se aceptarán más votos.")) return;
    setError(null);
    setTrabajando(true);
    const { error } = await supabase.rpc("cerrar_iniciativa", { p_id: id });
    setTrabajando(false);
    if (error) {
      setError(
        error.message?.includes("autoriz")
          ? "No autorizado para cerrar la votación."
          : `No se pudo cerrar la votación: ${error.message}`
      );
      return;
    }
    cargar();
  }

  if (!asambleaId) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-16 text-center">
        <p className="text-lg font-semibold text-codia-dark">
          No hay una asamblea abierta
        </p>
        <p className="mt-2 text-sm text-gray-600">
          Un administrador debe abrir la asamblea antes de poder someter
          iniciativas a votación. Las votaciones de asambleas anteriores están en
          el Histórico.
        </p>
      </main>
    );
  }

  const host = origin.replace(/^https?:\/\//, "");

  return (
    <main className="mx-auto max-w-5xl px-4 py-6">
      <div className="mb-5">
        <h1 className="text-xl font-bold text-codia-dark">Votaciones</h1>
        <p className="flex items-center gap-1.5 text-sm text-gray-500">
          <Users size={14} /> {asambleaNombre} · {presentes} presentes
          <span className="ml-2 inline-flex items-center gap-1 text-xs text-gray-400">
            <span
              className={`inline-block h-2 w-2 rounded-full ${
                errorCarga ? "bg-red-500" : "animate-pulse bg-emerald-500"
              }`}
            />
            {errorCarga ? "sin conexión" : "en vivo"}
          </span>
        </p>
      </div>

      {(error || errorCarga) && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertTriangle size={18} className="mt-0.5 shrink-0" />
          <span>{error ?? errorCarga}</span>
        </div>
      )}

      <div className="mb-6 grid gap-4 md:grid-cols-2">
        {cargando ? (
          <div className="flex items-center justify-center rounded-2xl border border-gray-200 bg-white p-6">
            <Loader2 className="animate-spin text-gray-400" />
          </div>
        ) : abierta ? (
          <div className="rounded-2xl border border-emerald-300 bg-white p-6 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600">
              Votación abierta
            </p>
            <h2 className="mt-1 text-lg font-bold text-codia-dark">{abierta.titulo}</h2>
            {abierta.descripcion && (
              <p className="mt-1 text-sm text-gray-600">{abierta.descripcion}</p>
            )}
            <div className="mt-5">
              <Tally c={conteoVotos(votos[abierta.id] ?? [])} presentes={presentes} />
            </div>
            <button
              onClick={() => cerrar(abierta.id)}
              disabled={trabajando}
              className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-amber-600 py-3 font-semibold text-white hover:bg-amber-700 disabled:opacity-60"
            >
              {trabajando ? (
                <Loader2 className="animate-spin" size={18} />
              ) : (
                <Square size={18} />
              )}
              Cerrar votación
            </button>
          </div>
        ) : (
          <form
            onSubmit={abrir}
            className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm"
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

        {/* QR fijo de (re)entrada: siempre visible para proyectar */}
        <div className="flex flex-col items-center justify-center rounded-2xl border border-gray-200 bg-white p-6 text-center shadow-sm">
          <p className="mb-3 text-sm font-semibold text-codia-dark">
            {abierta ? "Escanea para votar" : "Escanea para entrar a las votaciones"}
          </p>
          {origin && (
            <QRCodeSVG value={`${origin}/votar`} size={220} level="M" includeMargin />
          )}
          <p className="mt-3 text-xs text-gray-500">
            Los asambleístas registrados votan desde su teléfono. Si cerraron la
            página, escanean de nuevo y entran ya identificados.
          </p>
          {host && (
            <p className="mt-2 font-mono text-sm font-semibold text-codia-dark">
              {host}/votar
            </p>
          )}
        </div>
      </div>

      <VotacionesLista iniciativas={cerradas} votos={votos} />
    </main>
  );
}

function Tally({
  c,
  presentes,
}: {
  c: { favor: number; contra: number; abstencion: number; total: number };
  presentes: number;
}) {
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
}
