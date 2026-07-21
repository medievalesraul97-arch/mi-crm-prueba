"use client";

import { ConvexProvider, ConvexReactClient } from "convex/react";
import { ReactNode } from "react";

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
const convex = convexUrl ? new ConvexReactClient(convexUrl) : null;

// Hasta que se ejecute `npx convex dev` y se complete .env.local no hay URL de
// despliegue: en ese caso renderizamos sin provider en vez de romper el arranque.
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

  return <ConvexProvider client={convex}>{children}</ConvexProvider>;
}
