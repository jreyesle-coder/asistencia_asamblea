import Link from "next/link";
import LogoutButton from "./LogoutButton";
import { type Asamblea, type Rol } from "@/lib/types/database";

export default function Header({
  nombre,
  rol,
  asamblea,
}: {
  nombre: string;
  rol: Rol;
  asamblea?: Asamblea | null;
}) {
  return (
    <header className="bg-codia text-white shadow-md no-print">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
        <div className="flex items-center gap-3">
          <span className="flex h-10 items-center rounded-md bg-white px-2 py-1">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-codia.png" alt="CODIA" className="h-7 w-auto" />
          </span>
          <div className="leading-tight">
            <p className="text-sm font-semibold sm:text-base">Asamblea CODIA</p>
            <p className="text-[11px] text-white/70 sm:text-xs">
              {asamblea ? asamblea.nombre : "Sin asamblea abierta"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {(() => {
            const esAdmin = rol === "admin" || rol === "tecnologia";
            const verReportes = esAdmin || rol === "presidente";
            const verVotacion = rol === "presidente" || rol === "tecnologia";
            const cls =
              "rounded-md bg-white/10 px-3 py-1.5 text-sm font-medium transition hover:bg-white/20";
            if (!verReportes && !verVotacion) return null;
            return (
              <>
                <Link href="/" className={cls}>
                  Registro
                </Link>
                {verVotacion && (
                  <Link href="/votacion" className={cls}>
                    Votación
                  </Link>
                )}
                {verReportes && (
                  <Link href="/reporte" className={cls}>
                    Reporte
                  </Link>
                )}
                {verReportes && (
                  <Link href="/historico" className={cls}>
                    Histórico
                  </Link>
                )}
              </>
            );
          })()}
          <span className="hidden text-sm text-white/80 sm:inline">
            {nombre}
          </span>
          <LogoutButton />
        </div>
      </div>
    </header>
  );
}
