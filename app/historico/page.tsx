import { redirect } from "next/navigation";
import { getSessionConRol } from "@/lib/auth";
import { getAsambleaActiva } from "@/lib/asamblea";
import Header from "@/components/Header";
import HistoricoClient from "@/components/HistoricoClient";

export const dynamic = "force-dynamic";

export default async function HistoricoPage() {
  const sesion = await getSessionConRol();
  if (!sesion) redirect("/login");
  if (sesion.rol !== "admin") redirect("/");
  const asamblea = await getAsambleaActiva();

  return (
    <div className="min-h-screen">
      <Header nombre={sesion.nombre} rol={sesion.rol} asamblea={asamblea} />
      <HistoricoClient />
    </div>
  );
}
