import { redirect } from "next/navigation";
import { getSessionConRol } from "@/lib/auth";
import Header from "@/components/Header";
import RegistroClient from "@/components/RegistroClient";

export const dynamic = "force-dynamic";

export default async function RegistroPage() {
  const sesion = await getSessionConRol();
  if (!sesion) redirect("/login");

  return (
    <div className="min-h-screen">
      <Header nombre={sesion.nombre} rol={sesion.rol} />
      <RegistroClient rol={sesion.rol} nombreUsuario={sesion.nombre} />
    </div>
  );
}
