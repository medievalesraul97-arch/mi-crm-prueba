"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { esActiva, type NavItem } from "./nav-items";

interface TabBarProps {
  items: NavItem[];
}

/** Barra de pestañas inferior fija (móvil, <768px). */
export function TabBar({ items }: TabBarProps) {
  const pathname = usePathname();

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 flex border-t border-border bg-surface pb-[env(safe-area-inset-bottom)] md:hidden"
      aria-label="Navegación principal"
    >
      {items.map((item) => {
        const activa = esActiva(pathname, item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={activa ? "page" : undefined}
            className={cn(
              "flex min-h-[56px] flex-1 flex-col items-center justify-center gap-1 py-2 text-[11px] font-medium transition-colors",
              activa ? "text-primary" : "text-text-subtle",
            )}
          >
            <Icon className="h-[22px] w-[22px]" strokeWidth={1.5} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
