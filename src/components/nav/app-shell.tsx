"use client";

import Link from "next/link";
import { CircleUser } from "lucide-react";
import { type ReactNode, useMemo } from "react";
import { useAppData } from "@/components/providers/app-data-provider";
import { Sidebar } from "./sidebar";
import { TabBar } from "./tab-bar";
import { NAV_ITEMS } from "./nav-items";

/**
 * Shell de navegación: sidebar en escritorio, tab bar en móvil y cabecera móvil
 * con acceso a Perfil. Filtra las pestañas por rol (Equipo solo `propietaria`).
 * Solo se renderiza dentro del AuthGate, así que hay sesión.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const { currentUser } = useAppData();

  const items = useMemo(
    () =>
      NAV_ITEMS.filter(
        (item) => !item.ownerOnly || currentUser?.rol === "propietaria",
      ),
    [currentUser?.rol],
  );

  // Guarda defensiva de tipado (el AuthGate ya garantiza la sesión).
  if (!currentUser) return null;

  return (
    <div className="flex min-h-dvh">
      <Sidebar items={items} user={currentUser} />

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Cabecera móvil: marca + acceso a Perfil (no es una pestaña). */}
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-surface px-4 py-3 md:hidden">
          <span className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-[8px] bg-primary text-base font-semibold text-on-primary">
              V
            </span>
            <span className="text-[15px] font-semibold text-text">Vibe CRM</span>
          </span>
          <Link
            href="/cuenta"
            aria-label="Perfil / Mi cuenta"
            className="flex h-10 w-10 items-center justify-center rounded-md text-text-muted hover:bg-surface-2"
          >
            <CircleUser className="h-6 w-6" strokeWidth={1.5} />
          </Link>
        </header>

        <main className="mx-auto w-full max-w-[860px] flex-1 px-4 py-6 pb-28 md:px-8 md:py-8 md:pb-10">
          {children}
        </main>
      </div>

      <TabBar items={items} />
    </div>
  );
}
