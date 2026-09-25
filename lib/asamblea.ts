import { createClient } from "@/lib/supabase/server";
import { type Asamblea } from "@/lib/types/database";

export async function getAsambleaActiva(): Promise<Asamblea | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("asambleas")
    .select("id, nombre, fecha, estado")
    .eq("estado", "activa")
    .order("fecha", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as Asamblea) ?? null;
}
