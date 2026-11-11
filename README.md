# Asistencia Asamblea CODIA

App web para validar la asistencia de los asambleístas en el acto de asamblea del CODIA y realizar las **votaciones digitales** (nominales) de cada iniciativa. El personal de mesa digita **colegiatura, cédula o nombre**, confirma la persona y marca **Presente**; el asambleísta recibe un **QR / código de votante** y vota desde su teléfono en `/votar`. Conteo en vivo, reporte e histórico exportables a CSV.

- **Stack:** Next.js 14 (App Router) · Supabase (Auth + Postgres + RLS) · Tailwind
- **Roles:** `admin` (registro + reporte + histórico + abrir/cerrar asamblea + quitar asistencia) · `registrador` (registro y marcar presente) · `presidente` (somete iniciativas a votación en `/votacion`; ve reporte e histórico) · `tecnologia` (respaldo con acceso total)
- **Producción:** https://asamblea.rogapps.com (todo el staff debe entrar por ese dominio: la credencial del votante se guarda por dominio)

---

## 1. Crear el proyecto en Supabase

1. En [supabase.com](https://supabase.com) crea un proyecto nuevo (región más cercana: East US).
2. Ve a **SQL Editor** y ejecuta en orden `supabase/migrations/0001` … `0010`
   (0001 esquema · 0002/0004/0006 padrón · 0005 realtime · 0007/0008 asambleas y
   control de apertura · 0009 votaciones · 0010 ajustes de votaciones).
3. **Authentication → Users → Add user**: crea un usuario para el admin, uno por cada mesa,
   uno para el **presidente** y uno para **tecnología** (usa **Auto Confirm**).
4. Edita los correos en `supabase/migrations/0003_usuarios.sql` y ejecútalo para asignar roles
   **antes** de que esos usuarios inicien sesión.

Copia de **Project Settings → API**: `Project URL` y `anon public key`.

## 2. Variables de entorno

Crea `.env.local` (local) y las mismas variables en Vercel:

```
NEXT_PUBLIC_SUPABASE_URL=https://TU-PROYECTO.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu-anon-key
```

## 3. Correr local

```bash
npm install
npm run dev
```

Abre http://localhost:3000 → login con un usuario creado.

## 4. Desplegar (GitHub + Vercel)

```bash
git init && git add . && git commit -m "App asistencia CODIA"
# crea el repo en GitHub y:
git remote add origin https://github.com/TU-USUARIO/asistencia-codia.git
git push -u origin main
```

En Vercel: **New Project → importar el repo → agregar las 2 variables de entorno → Deploy.**

---

## Cómo se usa el día del evento

- Un **admin** (o tecnología) **abre la asamblea** desde Registro o Reporte. Sin asamblea abierta no se puede registrar.
- Cada mesa entra con su usuario. Digita **colegiatura o cédula** (con o sin guiones) → aparece la persona → **Marcar Presente** → se muestra el **QR + código de votante**; el asambleísta lo escanea en el momento (si no lo hizo, la mesa puede volver a enseñarlo con **Ver credencial**).
- El contador superior muestra **presentes / faltan / % asistencia** y se refresca solo (Realtime + 5 s).
- El **presidente** entra a **Votación**, proyecta el QR fijo de la pantalla, abre una iniciativa, ve el conteo en vivo y la cierra. Cada asambleísta vota en `/votar` (A favor / En contra / Abstención, con confirmación); el voto es nominal y único por iniciativa.
- El **admin** entra a **Reporte** para ver todo, filtrar por delegación, **Exportar CSV**, **Quitar** una asistencia marcada por error y **Cerrar la asamblea** (cierra cualquier votación abierta y archiva en **Histórico**, donde quedan asistencia y votaciones con su CSV nominal).
- Varias mesas pueden trabajar a la vez: la asistencia es compartida y no permite duplicados (un asambleísta no se puede marcar dos veces).
