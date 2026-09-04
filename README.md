# Asistencia Asamblea CODIA

App web para validar la asistencia de los **145 asambleístas** (Ganadores JD 2026-2027) en el acto de asamblea del CODIA. El personal de mesa digita **colegiatura, cédula o nombre**, confirma la persona y marca **Presente**. Conteo en vivo y reporte exportable a CSV.

- **Stack:** Next.js 14 (App Router) · Supabase (Auth + Postgres + RLS) · Tailwind
- **Roles:** `admin` (registro + reporte + exportar + quitar asistencia) · `registrador` (registro y marcar presente)

---

## 1. Crear el proyecto en Supabase

1. En [supabase.com](https://supabase.com) crea un proyecto nuevo (región más cercana: East US).
2. Ve a **SQL Editor** y ejecuta en orden:
   - `supabase/migrations/0001_schema.sql` → tablas, RLS y roles.
   - `supabase/migrations/0002_seed_asambleistas.sql` → carga los 145 asambleístas.
3. **Authentication → Users → Add user**: crea un usuario para el admin y uno por cada mesa
   (usa **Auto Confirm** para que no pidan verificación de correo).
4. Edita los correos en `supabase/migrations/0003_usuarios.sql` y ejecútalo para asignar roles.

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

- Cada mesa entra con su usuario. Digita **colegiatura o cédula** (con o sin guiones) → aparece la persona → **Marcar Presente**.
- El contador superior muestra **presentes / faltan / % asistencia** y se refresca solo cada 20 s.
- El **admin** entra a **Reporte** para ver todo, filtrar por delegación, **Exportar CSV** y, si hace falta, **Quitar** una asistencia marcada por error.
- Varias mesas pueden trabajar a la vez: la asistencia es compartida y no permite duplicados (un asambleísta no se puede marcar dos veces).
