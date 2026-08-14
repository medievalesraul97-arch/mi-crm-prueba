"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAppData } from "@/components/providers/app-data-provider";

/**
 * Protege las rutas del grupo (app): si no hay sesión, redirige a /login; si
 * hay sesión pero el cambio de contraseña inicial sigue pendiente (RAU-87
 * adenda), redirige a /cambiar-password-inicial en vez de dejar pasar. Este
 * redirect es defensa en profundidad de cara a la UI - la barrera real vive
 * en el backend (`requireIdentity`, convex/model/auth.ts): una sesión con
 * `debeCambiarPassword` no puede usar el CRM real aunque se salte esta
 * pantalla (DevTools, cliente Convex directo). Mientras se resuelve la
 * sesión, muestra un loader para no parpadear ni provocar mismatch de
 * hidratación.
 */
export function AuthGate({ children }: { children: ReactNode }) {
  const { authLoaded, currentUser, debeCambiarPassword } = useAppData();
  const router = useRouter();

  useEffect(() => {
    if (!authLoaded) return;
    if (!currentUser) router.replace("/login");
    else if (debeCambiarPassword) router.replace("/cambiar-password-inicial");
  }, [authLoaded, currentUser, debeCambiarPassword, router]);

  if (!authLoaded || !currentUser || debeCambiarPassword) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-bg">
        <div className="h-8 w-8 animate-vibe-spin rounded-full border-[3px] border-surface-2 border-t-primary" />
      </div>
    );
  }

  return <>{children}</>;
}
