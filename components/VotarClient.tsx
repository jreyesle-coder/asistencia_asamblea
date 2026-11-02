"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Loader2, CheckCircle2, ThumbsUp, ThumbsDown, MinusCircle } from "lucide-react";
import { type OpcionVoto } from "@/lib/types/database";

const TOKEN_KEY = "codia_voto_token";

interface Sesion {
  ok: boolean;
  motivo?: string;
  nombre?: string;
  colegiatura?: number;
  delegacion?: string;
  iniciativa?: { id: number; titulo: string; descripcion: string | null } | null;
  ya_voto?: boolean;
  mi_voto?: OpcionVoto | null;
}

const OPCIONES: {
  key: OpcionVoto;
  label: string;
  cls: string;
  Icon: typeof ThumbsUp;
}[] = [
  { key: "favor", label: "A favor", cls: "bg-emerald-600 hover:bg-emerald-700", Icon: ThumbsUp },
  { key: "contra", label: "En contra", cls: "bg-red-600 hover:bg-red-700", Icon: ThumbsDown },
  { key: "abstencion", label: "Abstención", cls: "bg-gray-500 hover:bg-gray-600", Icon: MinusCircle },
];

function etiqueta(o: OpcionVoto | null | undefined) {
  return OPCIONES.find((x) => x.key === o)?.label ?? "";
}

export default function VotarClient() {
  const supabase = useMemo(() => createClient(), []);
  const [token, setToken] = useState<string | null>(null);
  const [sesion, setSesion] = useState<Sesion | null>(null);
  const [cargando, setCargando] = useState(true);
  const [enviando, setEnviando] = useState<OpcionVoto | null>(null);
  // fallback por código
  const [col, setCol] = useState("");
  const [codigo, setCodigo] = useState("");
  const [errFallback, setErrFallback] = useState<string | null>(null);
  const yaVotoAnterior = useRef<number | null>(null);

  // Tomar token del URL (?t=) o del almacenamiento local
  useEffect(() => {
    const url = new URL(window.location.href);
    const t = url.searchParams.get("t");
    if (t) {
      localStorage.setItem(TOKEN_KEY, t);
      url.searchParams.delete("t");
      window.history.replaceState({}, "", url.pathname);
      setToken(t);
    } else {
      setToken(localStorage.getItem(TOKEN_KEY));
    }
  }, []);

  const cargar = useCallback(async () => {
    if (!token) return;
    const { data } = await supabase.rpc("votante_sesion", { p_token: token });
    setSesion((data as Sesion) ?? { ok: false, motivo: "token" });
    setCargando(false);
  }, [supabase, token]);

  // Poll cada 3 s para detectar nuevas votaciones
  useEffect(() => {
    if (!token) {
      setCargando(false);
      return;
    }
    cargar();
    const id = setInterval(cargar, 3000);
    return () => clearInterval(id);
  }, [token, cargar]);

  async function votar(opcion: OpcionVoto) {
    if (!token) return;
    setEnviando(opcion);
    await supabase.rpc("emitir_voto", { p_token: token, p_opcion: opcion });
    await cargar();
    setEnviando(null);
  }

  async function entrarPorCodigo(e: React.FormEvent) {
    e.preventDefault();
    setErrFallback(null);
    const { data } = await supabase.rpc("votante_por_codigo", {
      p_colegiatura: Number(col.replace(/\D/g, "")),
      p_codigo: codigo.trim(),
    });
    const r = data as { ok: boolean; token?: string };
    if (!r?.ok || !r.token) {
      setErrFallback("Colegiatura o código incorrecto, o no estás registrado.");
      return;
    }
    localStorage.setItem(TOKEN_KEY, r.token);
    setToken(r.token);
  }

  // ---------- Render ----------
  const header = (
    <div className="bg-codia px-4 py-3 text-white">
      <div className="mx-auto flex max-w-md items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-codia.png" alt="CODIA" className="h-7 rounded bg-white px-1.5 py-1" />
        <div className="leading-tight">
          <p className="text-sm font-semibold">Votaciones · Asamblea CODIA</p>
          {sesion?.ok && sesion.nombre && (
            <p className="text-[11px] text-white/80">
              {sesion.nombre} · Coleg. {sesion.colegiatura}
            </p>
          )}
        </div>
      </div>
    </div>
  );

  // Sin token, o token inválido → pedir código
  const necesitaCodigo = !token || (sesion && !sesion.ok);
  if (!cargando && necesitaCodigo) {
    return (
      <main className="min-h-screen bg-[#f4f6fb]">
        {header}
        <div className="mx-auto max-w-md px-4 py-10">
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <h1 className="text-lg font-bold text-codia-dark">Acceso a votación</h1>
            <p className="mt-1 text-sm text-gray-600">
              Escanea el <b>código que te dieron al registrar tu asistencia</b>, o
              ingrésalo aquí:
            </p>
            <form onSubmit={entrarPorCodigo} className="mt-4 space-y-3">
              <input
                inputMode="numeric"
                value={col}
                onChange={(e) => setCol(e.target.value)}
                placeholder="Número de colegiatura"
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-lg outline-none focus:border-codia"
                required
              />
              <input
                value={codigo}
                onChange={(e) => setCodigo(e.target.value)}
                placeholder="Código de votante"
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-lg uppercase outline-none focus:border-codia"
                required
              />
              {errFallback && (
                <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">
                  {errFallback}
                </p>
              )}
              <button
                type="submit"
                className="w-full rounded-lg bg-codia py-3 font-semibold text-white hover:bg-codia-dark"
              >
                Entrar a votar
              </button>
            </form>
          </div>
        </div>
      </main>
    );
  }

  if (cargando || !sesion) {
    return (
      <main className="min-h-screen bg-[#f4f6fb]">
        {header}
        <div className="flex items-center justify-center py-24 text-gray-400">
          <Loader2 className="animate-spin" />
        </div>
      </main>
    );
  }

  const ini = sesion.iniciativa;

  return (
    <main className="min-h-screen bg-[#f4f6fb]">
      {header}
      <div className="mx-auto max-w-md px-4 py-8">
        {!ini ? (
          <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm">
            <Loader2 className="mx-auto mb-3 animate-spin text-codia" size={32} />
            <p className="font-semibold text-codia-dark">
              Esperando una votación
            </p>
            <p className="mt-1 text-sm text-gray-500">
              Cuando el presidente abra una iniciativa, aparecerá aquí
              automáticamente.
            </p>
          </div>
        ) : sesion.ya_voto ? (
          <div className="rounded-2xl border border-emerald-300 bg-white p-8 text-center shadow-sm">
            <CheckCircle2 className="mx-auto mb-3 text-emerald-600" size={40} />
            <p className="text-sm text-gray-500">{ini.titulo}</p>
            <p className="mt-2 text-lg font-bold text-codia-dark">
              Tu voto: {etiqueta(sesion.mi_voto)}
            </p>
            <p className="mt-3 text-sm text-gray-500">
              Esperando la siguiente votación…
            </p>
          </div>
        ) : (
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-codia">
              Votación abierta
            </p>
            <h1 className="mt-1 text-xl font-bold text-codia-dark">{ini.titulo}</h1>
            {ini.descripcion && (
              <p className="mt-2 text-sm text-gray-600">{ini.descripcion}</p>
            )}
            <div className="mt-6 space-y-3">
              {OPCIONES.map(({ key, label, cls, Icon }) => (
                <button
                  key={key}
                  onClick={() => votar(key)}
                  disabled={enviando !== null}
                  className={`flex w-full items-center justify-center gap-2 rounded-xl py-4 text-lg font-bold text-white transition disabled:opacity-60 ${cls}`}
                >
                  {enviando === key ? (
                    <Loader2 className="animate-spin" size={22} />
                  ) : (
                    <Icon size={22} />
                  )}
                  {label}
                </button>
              ))}
            </div>
            <p className="mt-4 text-center text-xs text-gray-400">
              Tu voto queda registrado a tu nombre.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
