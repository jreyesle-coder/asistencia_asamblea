"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Loader2, CalendarPlus, X } from "lucide-react";

function hoyISO() {
  const d = new Date();
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 10);
}

export default function AbrirAsambleaModal({
  onClose,
}: {
  onClose: () => void;
}) {
  const supabase = createClient();
  const [fecha, setFecha] = useState(hoyISO());
  const [nombre, setNombre] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function abrir(e: React.FormEvent) {
    e.preventDefault();
    if (!fecha) return;
    setError(null);
    setLoading(true);
    const { error } = await supabase.rpc("abrir_asamblea", {
      p_nombre: nombre.trim(),
      p_fecha: fecha,
    });
    if (error) {
      setLoading(false);
      setError(
        error.message?.includes("Ya hay")
          ? "Ya hay una asamblea abierta."
          : error.message?.includes("autorizado")
          ? "No autorizado: se requiere un administrador."
          : "No se pudo abrir la asamblea. Intente de nuevo."
      );
      return;
    }
    window.location.reload();
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
          <div className="flex items-center gap-2 text-codia-dark">
            <CalendarPlus size={22} />
            <h2 className="text-lg font-bold">Abrir asamblea</h2>
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
          Se habilitará el registro de asistencia para una nueva asamblea (en
          0). El listado de asambleístas se mantiene igual.
        </p>

        <form onSubmit={abrir} className="space-y-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Fecha de la asamblea
            </label>
            <input
              type="date"
              required
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 outline-none focus:border-codia focus:ring-2 focus:ring-codia/20"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Nombre (opcional)
            </label>
            <input
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Se genera de la fecha si lo dejas vacío"
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 outline-none focus:border-codia focus:ring-2 focus:ring-codia/20"
            />
          </div>

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
              disabled={!fecha || loading}
              className="flex items-center gap-2 rounded-lg bg-codia px-4 py-2 text-sm font-semibold text-white hover:bg-codia-dark disabled:opacity-50"
            >
              {loading && <Loader2 size={16} className="animate-spin" />}
              Abrir asamblea
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
