"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  Loader2,
  CheckCircle2,
  ThumbsUp,
  ThumbsDown,
  MinusCircle,
  WifiOff,
  AlertTriangle,
} from "lucide-react";
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

function opcionDe(o: OpcionVoto | null | undefined) {
  return OPCIONES.find((x) => x.key === o) ?? null;
}

export default function VotarClient() {
  const supabase = useMemo(() => createClient(), []);
  const [token, setToken] = useState<string | null>(null);
  const [tokenListo, setTokenListo] = useState(false);
  const [sesion, setSesion] = useState<Sesion | null>(null);
  const [intentado, setIntentado] = useState(false); // ya hubo una respuesta (o fallo)
  const [sinConexion, setSinConexion] = useState(false);
  const [credencialInvalida, setCredencialInvalida] = useState(false);
  const [seleccion, setSeleccion] = useState<OpcionVoto | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  // fallback por código
  const [col, setCol] = useState("");
  const [codigo, setCodigo] = useState("");
  const [errFallback, setErrFallback] = useState<string | null>(null);
  const [entrando, setEntrando] = useState(false);
  // Guardas contra respuestas fuera de orden (redes móviles lentas): sólo se
  // aplica la respuesta más reciente y sólo si sigue siendo el mismo token.
  const tokenRef = useRef<string | null>(null);
  const seqRef = useRef(0);
  useEffect(() => {
    tokenRef.current = token;
  }, [token]);

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
    setTokenListo(true);
  }, []);

  const cargar = useCallback(async () => {
    if (!token) return;
    const seq = ++seqRef.current;
    const { data, error } = await supabase.rpc("votante_sesion", { p_token: token });
    // Respuesta tardía (ya hubo otra más nueva) o de un token anterior: se ignora
    if (seq !== seqRef.current || tokenRef.current !== token) return;
    setIntentado(true);
    if (error || !data) {
      // Fallo de red/servidor: conservamos la sesión anterior y avisamos
      setSinConexion(true);
      return;
    }
    setSinConexion(false);
    const s = data as Sesion;
    if (!s.ok) {
      // Credencial inválida (asistencia eliminada o asamblea cerrada)
      localStorage.removeItem(TOKEN_KEY);
      setCredencialInvalida(true);
      setSesion(null);
      setToken(null);
      return;
    }
    if (s.ya_voto) {
      // El voto ya consta (aunque la respuesta de emitir_voto se haya perdido)
      setAviso(null);
      setSeleccion(null);
    }
    setSesion(s);
  }, [supabase, token]);

  // Poll cada 3 s para detectar nuevas votaciones
  useEffect(() => {
    if (!token) return;
    cargar();
    const id = setInterval(cargar, 3000);
    return () => clearInterval(id);
  }, [token, cargar]);

  // Si cambia la iniciativa en pantalla, descartamos la selección previa.
  // El aviso NO se limpia aquí: debe seguir visible tras un 'cambio'/'cerrada'
  // (se limpia cuando el votante vuelve a elegir una opción).
  const iniId = sesion?.iniciativa?.id ?? null;
  useEffect(() => {
    setSeleccion(null);
  }, [iniId]);

  async function confirmar() {
    if (!token || !seleccion || !sesion?.iniciativa) return;
    setEnviando(true);
    setAviso(null);
    const args = { p_token: token, p_opcion: seleccion };
    let { data, error } = await supabase.rpc("emitir_voto", {
      ...args,
      p_iniciativa_id: sesion.iniciativa.id,
    });
    if (error && /p_iniciativa_id|PGRST202|find the function/i.test(error.message ?? "")) {
      // Base de datos sin la migración 0010: firma anterior sin iniciativa
      ({ data, error } = await supabase.rpc("emitir_voto", args));
    }
    setEnviando(false);
    if (error) {
      setAviso("No se pudo enviar tu voto. Revisa la conexión e inténtalo de nuevo.");
      return;
    }
    const r = data as { ok: boolean; motivo?: string };
    if (!r?.ok) {
      setAviso(
        r?.motivo === "cambio"
          ? "La votación cambió mientras elegías. Revisa la nueva iniciativa y vota de nuevo."
          : r?.motivo === "cerrada"
          ? "La votación se cerró antes de recibir tu voto."
          : "Tu credencial ya no es válida. Acércate a la mesa de registro."
      );
    }
    setSeleccion(null);
    await cargar();
  }

  async function entrarPorCodigo(e: React.FormEvent) {
    e.preventDefault();
    setErrFallback(null);
    setEntrando(true);
    const { data, error } = await supabase.rpc("votante_por_codigo", {
      p_colegiatura: Number(col.replace(/\D/g, "")),
      p_codigo: codigo.trim(),
    });
    setEntrando(false);
    if (error) {
      setErrFallback("Sin conexión. Inténtalo de nuevo.");
      return;
    }
    const r = data as { ok: boolean; token?: string };
    if (!r?.ok || !r.token) {
      setErrFallback("Colegiatura o código incorrecto, o no estás registrado.");
      return;
    }
    localStorage.setItem(TOKEN_KEY, r.token);
    setCredencialInvalida(false);
    setSesion(null);
    setIntentado(false);
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

  const spinner = (
    <main className="min-h-screen bg-[#f4f6fb]">
      {header}
      <div className="flex items-center justify-center py-24 text-gray-400">
        <Loader2 className="animate-spin" />
      </div>
    </main>
  );

  if (!tokenListo) return spinner;

  // Sin token (o credencial anulada) → pedir colegiatura + código
  if (!token) {
    return (
      <main className="min-h-screen bg-[#f4f6fb]">
        {header}
        <div className="mx-auto max-w-md px-4 py-10">
          {credencialInvalida && (
            <div className="mb-4 flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              <AlertTriangle size={18} className="mt-0.5 shrink-0" />
              <span>
                Tu credencial de votante ya no es válida (la asistencia fue
                retirada o la asamblea se cerró). Acércate a la mesa de registro.
              </span>
            </div>
          )}
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
                autoCapitalize="characters"
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
                disabled={entrando}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-codia py-3 font-semibold text-white hover:bg-codia-dark disabled:opacity-60"
              >
                {entrando && <Loader2 className="animate-spin" size={18} />}
                Entrar a votar
              </button>
            </form>
          </div>
        </div>
      </main>
    );
  }

  if (!sesion) {
    if (!intentado || !sinConexion) return spinner;
    return (
      <main className="min-h-screen bg-[#f4f6fb]">
        {header}
        <div className="mx-auto max-w-md px-4 py-10">
          <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm">
            <WifiOff className="mx-auto mb-3 text-gray-400" size={36} />
            <p className="font-semibold text-codia-dark">Sin conexión</p>
            <p className="mt-1 text-sm text-gray-500">
              No se pudo contactar el servidor. Reintentando automáticamente…
            </p>
          </div>
        </div>
      </main>
    );
  }

  const ini = sesion.iniciativa;
  const sel = opcionDe(seleccion);

  return (
    <main className="min-h-screen bg-[#f4f6fb]">
      {header}
      <div className="mx-auto max-w-md px-4 py-8">
        {sinConexion && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm text-amber-800">
            <WifiOff size={16} /> Sin conexión, reintentando…
          </div>
        )}
        {aviso && (
          <div className="mb-4 flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <AlertTriangle size={18} className="mt-0.5 shrink-0" />
            <span>{aviso}</span>
          </div>
        )}

        {!ini ? (
          <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm">
            <Loader2 className="mx-auto mb-3 animate-spin text-codia" size={32} />
            <p className="font-semibold text-codia-dark">Esperando una votación</p>
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
              Tu voto: {opcionDe(sesion.mi_voto)?.label ?? ""}
            </p>
            <p className="mt-3 text-sm text-gray-500">Esperando la siguiente votación…</p>
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

            {!sel ? (
              <>
                <div className="mt-6 space-y-3">
                  {OPCIONES.map(({ key, label, cls, Icon }) => (
                    <button
                      key={key}
                      onClick={() => {
                        setAviso(null);
                        setSeleccion(key);
                      }}
                      className={`flex w-full items-center justify-center gap-2 rounded-xl py-4 text-lg font-bold text-white transition ${cls}`}
                    >
                      <Icon size={22} />
                      {label}
                    </button>
                  ))}
                </div>
                <p className="mt-4 text-center text-xs text-gray-400">
                  Elige una opción; después te pediremos confirmarla.
                </p>
              </>
            ) : (
              <div className="mt-6">
                <p className="text-center text-sm text-gray-600">Vas a votar</p>
                <div
                  className={`mt-2 flex items-center justify-center gap-2 rounded-xl py-4 text-xl font-extrabold text-white ${sel.cls}`}
                >
                  <sel.Icon size={24} /> {sel.label}
                </div>
                <button
                  onClick={confirmar}
                  disabled={enviando}
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-codia py-4 text-lg font-bold text-white hover:bg-codia-dark disabled:opacity-60"
                >
                  {enviando ? (
                    <Loader2 className="animate-spin" size={22} />
                  ) : (
                    <CheckCircle2 size={22} />
                  )}
                  Confirmar mi voto
                </button>
                <button
                  onClick={() => setSeleccion(null)}
                  disabled={enviando}
                  className="mt-2 w-full rounded-xl border border-gray-300 py-3 font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                >
                  Cambiar
                </button>
                <p className="mt-4 text-center text-xs text-gray-400">
                  Tu voto queda registrado a tu nombre y no se puede modificar.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
