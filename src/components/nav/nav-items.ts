import type { LucideIcon } from "lucide-react";
import { House, Shield, TrendingUp, Users } from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Solo visible para el rol `propietaria` (gating de UI/mock, no seguridad). */
  ownerOnly?: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/hoy", label: "Hoy", icon: House },
  { href: "/clientes", label: "Clientes", icon: Users },
  { href: "/ventas", label: "Ventas", icon: TrendingUp },
  { href: "/equipo", label: "Equipo", icon: Shield, ownerOnly: true },
];

/** Ruta activa: coincidencia exacta o segmento hijo. */
export function esActiva(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}
