import Link from "next/link";
import LogoutButton from "./LogoutButton";
import { type Rol } from "@/lib/types/database";

export default function Header({
  nombre,
  rol,
}: {
  nombre: string;
  rol: Rol;
}) {
  return (
    <header className="bg-codia text-white shadow-md no-print">
      <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-4 py-3">
        <div className="flex items-center gap-3">
          <span className="flex h-10 items-center rounded-md bg-white px-2 py-1">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-codia.png" alt="CODIA" className="h-7 w-auto" />
          </span>
          <div className="leading-tight">
            <p className="text-sm font-semibold sm:text-base">Asamblea CODIA</p>
            <p className="text-[11px] text-white/70 sm:text-xs">
              Validación de asistencia
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {rol === "admin" && (
            <>
              <Link
                href="/"
                className="rounded-md bg-white/10 px-3 py-1.5 text-sm font-medium transition hover:bg-white/20"
              >
                Registro
              </Link>
              <Link
                href="/reporte"
                className="rounded-md bg-white/10 px-3 py-1.5 text-sm font-medium transition hover:bg-white/20"
              >
                Reporte
              </Link>
            </>
          )}
          <span className="hidden text-sm text-white/80 sm:inline">
            {nombre}
          </span>
          <LogoutButton />
        </div>
      </div>
    </header>
  );
}
