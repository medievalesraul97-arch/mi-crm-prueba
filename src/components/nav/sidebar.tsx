"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { useAppData } from "@/components/providers/app-data-provider";
import { cn } from "@/lib/utils";
import type { Usuario } from "@/lib/types";
import { esActiva, type NavItem } from "./nav-items";

interface SidebarProps {
  items: NavItem[];
  user: Usuario;
}

const ROL_LABEL: Record<Usuario["rol"], string> = {
  propietaria: "Dueña",
  comercial: "Atiende y vende",
};

/** Barra lateral de escritorio (>=768px), 240px, en columna. */
export function Sidebar({ items, user }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { logout } = useAppData();

  function cerrarSesion() {
    logout();
    router.replace("/login");
  }

  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r border-border bg-surface md:flex">
      <div className="flex items-center gap-2 px-5 py-5">
        <span className="flex h-[34px] w-[34px] items-center justify-center rounded-[9px] bg-primary text-lg font-semibold text-on-primary">
          V
        </span>
        <span className="text-[15px] font-semibold text-text">Vibe CRM</span>
      </div>

      <nav className="flex flex-1 flex-col gap-1 px-3">
        {items.map((item) => {
          const activa = esActiva(pathname, item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={activa ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2.5 text-[15px] font-medium transition-colors",
                activa
                  ? "bg-primary-subtle text-primary"
                  : "text-text-muted hover:bg-surface-2",
              )}
            >
              <Icon className="h-5 w-5" strokeWidth={1.5} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-border p-3">
        <div className="flex items-center gap-3">
          <Link
            href="/cuenta"
            className="flex min-w-0 flex-1 items-center gap-3 rounded-md p-2 hover:bg-surface-2"
          >
            <Avatar name={user.nombre} />
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium text-text">
                {user.nombre}
              </span>
              <span className="block truncate text-[13px] text-text-muted">
                {ROL_LABEL[user.rol]}
              </span>
            </span>
          </Link>
          <button
            type="button"
            onClick={cerrarSesion}
            aria-label="Cerrar sesión"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-text-muted hover:bg-surface-2"
          >
            <LogOut className="h-5 w-5" strokeWidth={1.5} />
          </button>
        </div>
      </div>
    </aside>
  );
}
