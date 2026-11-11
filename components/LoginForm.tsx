"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Loader2 } from "lucide-react";

export default function LoginForm({
  sinPerfil = null,
}: {
  sinPerfil?: string | null;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saliendo, setSaliendo] = useState(false);

  async function salir() {
    setSaliendo(true);
    await supabase.auth.signOut();
    router.refresh();
    setSaliendo(false);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (error) {
      setError("Correo o contraseña incorrectos.");
      setLoading(false);
      return;
    }
    router.replace("/");
    router.refresh();
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-codia px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-7 shadow-xl">
        <div className="mb-6 flex flex-col items-center text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-codia.png" alt="CODIA" className="mb-3 h-12 w-auto" />
          <h1 className="text-lg font-bold text-codia-dark">
            Asistencia Asamblea
          </h1>
          <p className="text-sm text-gray-500">Acceso del personal de registro</p>
        </div>

        {sinPerfil && (
          <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <p>
              <b>{sinPerfil}</b> inició sesión pero <b>no tiene un perfil activo</b>{" "}
              en la app. Pide a Tecnología que le asigne un rol (admin,
              registrador, presidente o tecnología).
            </p>
            <button
              type="button"
              onClick={salir}
              disabled={saliendo}
              className="mt-2 rounded-md border border-amber-400 bg-white px-3 py-1.5 text-xs font-semibold text-amber-800 hover:bg-amber-100 disabled:opacity-60"
            >
              {saliendo ? "Saliendo…" : "Cerrar sesión y entrar con otro usuario"}
            </button>
          </div>
        )}

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Correo
            </label>
            <input
              type="email"
              required
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 outline-none focus:border-codia focus:ring-2 focus:ring-codia/20"
              placeholder="usuario@codia.org.do"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Contraseña
            </label>
            <input
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 outline-none focus:border-codia focus:ring-2 focus:ring-codia/20"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-codia py-2.5 font-semibold text-white transition hover:bg-codia-dark disabled:opacity-60"
          >
            {loading && <Loader2 size={18} className="animate-spin" />}
            Entrar
          </button>
        </form>
      </div>
    </main>
  );
}
