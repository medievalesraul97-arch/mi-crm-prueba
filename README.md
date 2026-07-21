# Vibe CRM

CRM móvil-primero (PWA) para un pequeño negocio de ventas digitales. UI en español.

**Stack:** Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS v4 · Convex (backend, en integración).

## Estado

Primera iteración de la **experiencia de entrada** de la app:

- **Hoy** (`/hoy`, pantalla inicial): tareas del día con accesos rápidos — secciones *Atrasados* y *Para hoy*, marcar hecho con deshacer, y overlay de *Nueva tarea* (RAU-113).
- **Navegación** (RAU-76): sidebar en escritorio / bottom tab bar en móvil, con acceso a Perfil y visibilidad de *Equipo* según el rol.

Los datos son de **ejemplo en memoria (mock)**. El backend real (Convex) y el login (auth) llegan en tareas posteriores; el proveedor de Convex funciona en modo no-op mientras no exista `NEXT_PUBLIC_CONVEX_URL`, de modo que la app **compila y arranca sin backend**.

## Desarrollo local

```bash
npm install
npm run dev        # http://localhost:3000  (redirige a /hoy)
```

Opcional, para trabajar el backend Convex:

```bash
cp .env.local.example .env.local
npx convex dev     # inicia sesión, crea/vincula el proyecto y rellena .env.local
```

Comprobaciones de calidad:

```bash
npm run lint
npx tsc --noEmit
npm run build
```

## Despliegue en Railway

El repositorio está conectado a Railway para **despliegue automático desde GitHub** (constructor Nixpacks). Configuración en `railway.json`:

- **Build:** `npm run build`
- **Start:** `npm run start` (`next start`, escucha en `$PORT` que inyecta Railway)
- **Node:** >= 20 (ver `.node-version` y `engines` en `package.json`)
- **Healthcheck:** `/hoy`
- **Variables de entorno:** ninguna requerida en esta iteración. Cuando entre el backend, configura en Railway `NEXT_PUBLIC_CONVEX_URL` (y despliega Convex con `npx convex deploy`).

## Gestión del proyecto

Tareas en Linear (equipo *RAUL MARTIN*, proyecto `crm-mvp`), con identificadores `RAU-##`. Diseño y sistema de tokens en `diseño/` (`design.md` + handoff).
