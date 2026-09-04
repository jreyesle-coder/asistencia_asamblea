import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  const supabaseResponse = NextResponse.next({ request });

  const { pathname } = request.nextUrl;
  const publicPaths = ["/login"];

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Sin variables de entorno no podemos validar sesión: dejamos pasar
  // en vez de tumbar todo el sitio con un 500 (MIDDLEWARE_INVOCATION_FAILED).
  if (!url || !anon) {
    return supabaseResponse;
  }

  try {
    let response = supabaseResponse;

    const supabase = createServerClient(url, anon, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    });

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user && !publicPaths.includes(pathname)) {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = "/login";
      return NextResponse.redirect(redirectUrl);
    }

    if (user && pathname === "/login") {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = "/";
      return NextResponse.redirect(redirectUrl);
    }

    return response;
  } catch (e) {
    // Ante cualquier fallo (config o red), no tumbamos el sitio: dejamos pasar.
    console.error("middleware error:", e);
    return supabaseResponse;
  }
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|favicon.png|logo-codia.png|api/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
