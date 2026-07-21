import type { ReactNode } from "react";
import { AuthGate } from "@/components/auth/auth-gate";
import { AppShell } from "@/components/nav/app-shell";

// Los providers (datos mock + toast) viven ahora en el layout raíz para que
// /login también los tenga. Aquí solo protegemos con AuthGate (redirige a
// /login si no hay sesión) y montamos el shell de navegación.
export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <AuthGate>
      <AppShell>{children}</AppShell>
    </AuthGate>
  );
}
