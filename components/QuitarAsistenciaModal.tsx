"use client";

import { useState } from "react";
import { createClient as createSbClient } from "@supabase/supabase-js";
import { Loader2, ShieldAlert, X } from "lucide-react";

export default function QuitarAsistenciaModal({
  asambleistaId,
  nombre,
  onClose,
  onDone,
}: {
  asambleistaId: number;
  nombre: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function confirmar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    // Cliente EFÍMERO: no persiste sesión, así no cambia la sesión activa
    // del operador que está registrando en la tableta/celular.
    const aprobador = createSbClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          storageKey: "codia-aprobador",
        },
      }
    );

    const { error: authError } = await aprobador.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (authError) {
      setError("Correo o contraseña del administrador incorrectos.");
      setLoading(false);
      return;
    }

    // Borra usando el token del administrador. Si quien aprueba NO es admin,
    // el RLS filtra la fila y no se elimina nada (data vacío) -> no autorizado.
    const { data, error: delError } = await aprobador
      .from("asistencia")
      .delete()
      .eq("asambleista_id", asambleistaId)
      .select();

    await aprobador.auth.signOut();
    setLoading(false);

    if (delError) {
      setError("No se pudo quitar la asistencia. Intente de nuevo.");
      return;
    }
    if (!data || data.length === 0) {
      setError(
        "Ese usuario no está autorizado para eliminar asistencias (se requiere un administrador)."
      );
      return;
    }
    onDone();
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between">
          <div className="flex items-center gap-2 text-red-600">
            <ShieldAlert size={22} />
            <h2 className="text-lg font-bold">Quitar asistencia</h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-1 text-gray-400 hover:bg-gray-100"
            aria-label="Cerrar"
          >
            <X size={20} />
          </button>
        </div>

        <p className="mb-4 text-sm text-gray-600">
          Vas a quitar la asistencia de{" "}
          <b className="text-gray-900">{nombre}</b>. Esta acción debe ser
          autorizada por un <b>administrador</b> con su correo y contraseña.
        </p>

        <form onSubmit={confirmar} className="space-y-3">
          <input
            type="email"
            autoFocus
            required
            autoComplete="off"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Correo del administrador"
            className="w-full rounded-lg border border-gray-300 px-3 py-2.5 outline-none focus:border-codia focus:ring-2 focus:ring-codia/20"
          />
          <input
            type="password"
            required
            autoComplete="off"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Contraseña del administrador"
            className="w-full rounded-lg border border-gray-300 px-3 py-2.5 outline-none focus:border-codia focus:ring-2 focus:ring-codia/20"
          />
          {error && (
            <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
            >
              {loading && <Loader2 size={16} className="animate-spin" />}
              Autorizar y quitar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
