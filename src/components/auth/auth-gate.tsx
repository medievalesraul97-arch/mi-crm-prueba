"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAppData } from "@/components/providers/app-data-provider";

/**
 * Protege las rutas del grupo (app): si no hay sesión (login mock), redirige a
 * /login. Mientras se lee la sesión de localStorage, muestra un loader para no
 * parpadear ni provocar mismatch de hidratación.
 */
export function AuthGate({ children }: { children: ReactNode }) {
  const { authLoaded, currentUser } = useAppData();
  const router = useRouter();

  useEffect(() => {
    if (authLoaded && !currentUser) router.replace("/login");
  }, [authLoaded, currentUser, router]);

  if (!authLoaded || !currentUser) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-bg">
        <div className="h-8 w-8 animate-vibe-spin rounded-full border-[3px] border-surface-2 border-t-primary" />
      </div>
    );
  }

  return <>{children}</>;
}
