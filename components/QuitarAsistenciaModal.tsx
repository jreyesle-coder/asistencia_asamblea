"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
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
  const supabase = createClient();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function confirmar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    // 1) Re-autenticar: confirmar que es el admin quien autoriza
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user?.email) {
      setError("Sesión no válida. Vuelva a iniciar sesión.");
      setLoading(false);
      return;
    }
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password,
    });
    if (authError) {
      setError("Contraseña incorrecta. No se quitó la asistencia.");
      setLoading(false);
      return;
    }

    // 2) Quitar la asistencia
    const { error: delError } = await supabase
      .from("asistencia")
      .delete()
      .eq("asambleista_id", asambleistaId);
    setLoading(false);
    if (delError) {
      setError("No se pudo quitar la asistencia. Intente de nuevo.");
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
          <b className="text-gray-900">{nombre}</b>. Para confirmar, ingresa la
          contraseña del administrador.
        </p>

        <form onSubmit={confirmar} className="space-y-3">
          <input
            type="password"
            autoFocus
            required
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
              Quitar asistencia
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
