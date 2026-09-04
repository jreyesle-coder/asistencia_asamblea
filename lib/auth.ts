import { createClient } from "@/lib/supabase/server";
import { type Rol } from "@/lib/types/database";

export interface SesionConRol {
  user: { id: string; email: string | undefined };
  rol: Rol;
  nombre: string;
}

export async function getSessionConRol(): Promise<SesionConRol | null> {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) return null;

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("rol, nombre, activo")
    .eq("id", user.id)
    .single();

  if (profileError || !profile || !profile.activo) return null;

  return {
    user: { id: user.id, email: user.email },
    rol: profile.rol as Rol,
    nombre: profile.nombre,
  };
}
