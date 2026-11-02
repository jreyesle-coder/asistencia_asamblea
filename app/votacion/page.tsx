import { redirect } from "next/navigation";
import { getSessionConRol } from "@/lib/auth";
import { getAsambleaActiva } from "@/lib/asamblea";
import Header from "@/components/Header";
import VotacionControlClient from "@/components/VotacionControlClient";

export const dynamic = "force-dynamic";

export default async function VotacionPage() {
  const sesion = await getSessionConRol();
  if (!sesion) redirect("/login");
  if (sesion.rol !== "presidente" && sesion.rol !== "tecnologia") redirect("/");
  const asamblea = await getAsambleaActiva();

  return (
    <div className="min-h-screen">
      <Header nombre={sesion.nombre} rol={sesion.rol} asamblea={asamblea} />
      <VotacionControlClient
        asambleaId={asamblea?.id ?? null}
        asambleaNombre={asamblea?.nombre ?? null}
      />
    </div>
  );
}
