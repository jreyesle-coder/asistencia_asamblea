import { redirect } from "next/navigation";
import { getSessionConRol } from "@/lib/auth";
import Header from "@/components/Header";
import ReporteClient from "@/components/ReporteClient";

export const dynamic = "force-dynamic";

export default async function ReportePage() {
  const sesion = await getSessionConRol();
  if (!sesion) redirect("/login");
  if (sesion.rol !== "admin") redirect("/");

  return (
    <div className="min-h-screen">
      <Header nombre={sesion.nombre} rol={sesion.rol} />
      <ReporteClient />
    </div>
  );
}
