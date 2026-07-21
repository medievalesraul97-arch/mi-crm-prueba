import type { ReactNode } from "react";
import { AppDataProvider } from "@/components/providers/app-data-provider";
import { ToastProvider } from "@/components/providers/toast-provider";
import { AppShell } from "@/components/nav/app-shell";

// Server Component: monta los providers cliente (datos mock + toast) y el shell
// de navegación, envolviendo las páginas del grupo. El root `src/app/layout.tsx`
// (con ConvexClientProvider) no se toca. Los layouts preservan estado en
// navegación cliente, así que marcar hecho / crear persiste entre pestañas.
export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <AppDataProvider>
      <ToastProvider>
        <AppShell>{children}</AppShell>
      </ToastProvider>
    </AppDataProvider>
  );
}
