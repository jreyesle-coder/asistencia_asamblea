export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

  let urlHost = "";
  try {
    urlHost = url ? new URL(url).host : "";
  } catch {
    urlHost = "URL_INVALIDA";
  }

  return Response.json({
    ok: !!url && !!anon,
    hasUrl: !!url,
    urlHost, // solo el host, no expone secreto
    hasAnon: !!anon,
    anonLen: anon.length, // longitud, no el valor
    // nombres de variables NEXT_PUBLIC visibles (para detectar typos)
    publicKeys: Object.keys(process.env)
      .filter((k) => k.startsWith("NEXT_PUBLIC"))
      .sort(),
  });
}
