"use client";

import { ConvexReactClient } from "convex/react";
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { ReactNode } from "react";

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
const convex = convexUrl ? new ConvexReactClient(convexUrl) : null;

// Hasta que se ejecute `npx convex dev` y se complete .env.local no hay URL de
// despliegue: en ese caso renderizamos sin provider en vez de romper el arranque.
// `AppDataProvider` (RAU-87) es quien deja de llamar a ningún hook de Convex
// Auth en ese caso - no este provider (ver AppDataProviderSinBackend).
export function ConvexClientProvider({ children }: { children: ReactNode }) {
  if (!convex) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(
        "[vibe-crm] NEXT_PUBLIC_CONVEX_URL no está definida. Ejecuta `npx convex dev` " +
          "y copia la URL a .env.local (ver .env.local.example) para conectar el backend.",
      );
    }
    return <>{children}</>;
  }

  return (
    // shouldHandleCode=false (RAU-213): el manejo automático de `?code=` de
    // la librería no distingue "rechazado por el servidor" de "todavía no
    // se ha intentado nada" (ambos vuelven sin `code`) y su intercambio
    // corre en un efecto interno sin try/catch, así que un rechazo de
    // Google nunca llegaría a mostrarse - login/page.tsx lo maneja a mano
    // (GoogleRedirectHandler) para poder mostrar un error visible.
    <ConvexAuthProvider client={convex} shouldHandleCode={false}>
      {children}
    </ConvexAuthProvider>
  );
}
