import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSessionConRol } from "@/lib/auth";
import LoginForm from "@/components/LoginForm";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Con sesión y perfil activo → a la app. Con sesión pero SIN perfil activo
  // mostramos el aviso (antes esto producía un bucle /login ↔ /).
  let sinPerfil: string | null = null;
  if (user) {
    const sesion = await getSessionConRol();
    if (sesion) redirect("/");
    sinPerfil = user.email ?? "este usuario";
  }

  return <LoginForm sinPerfil={sinPerfil} />;
}
