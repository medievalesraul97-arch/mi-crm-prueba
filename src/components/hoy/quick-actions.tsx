"use client";

import {
  ClipboardList,
  MessageSquare,
  TrendingUp,
  UserPlus,
  type LucideIcon,
} from "lucide-react";
import { Sheet } from "@/components/ui/sheet";
import { NuevaTareaForm } from "./nueva-tarea-form";
import { NuevoClienteForm } from "./nuevo-cliente-form";
import { RegistrarInteraccionForm } from "./registrar-interaccion-form";
import { RegistrarVentaForm } from "./registrar-venta-form";
import { cn } from "@/lib/utils";

export type Accion = "tarea" | "interaccion" | "venta" | "cliente";

interface Tile {
  key: Accion;
  label: string;
  icon: LucideIcon;
  destacada?: boolean;
}

const TILES: Tile[] = [
  { key: "tarea", label: "Nueva tarea", icon: ClipboardList, destacada: true },
  { key: "interaccion", label: "Anotar interacción", icon: MessageSquare },
  { key: "venta", label: "Registrar venta", icon: TrendingUp },
  { key: "cliente", label: "Nuevo cliente", icon: UserPlus },
];

const TITULOS: Record<Accion, string> = {
  tarea: "Nueva tarea",
  interaccion: "Anotar interacción",
  venta: "Registrar venta",
  cliente: "Nuevo cliente",
};

/** Rejilla de accesos rápidos (2x2 móvil / 4 columnas escritorio). */
export function QuickActions({ onOpen }: { onOpen: (accion: Accion) => void }) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {TILES.map((t) => {
        const Icon = t.icon;
        return (
          <button
            key={t.key}
            type="button"
            onClick={() => onOpen(t.key)}
            className="flex flex-col items-center gap-2 rounded-xl border border-border bg-surface p-4 text-center shadow-xs transition-colors hover:bg-surface-2"
          >
            <span
              className={cn(
                "flex h-11 w-11 items-center justify-center rounded-full",
                t.destacada
                  ? "bg-primary text-on-primary"
                  : "bg-primary-subtle text-primary",
              )}
            >
              <Icon className="h-5 w-5" strokeWidth={1.5} />
            </span>
            <span className="text-[13px] font-medium text-text">{t.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/**
 * Overlay de la acción abierta. Las cuatro acciones (Nueva tarea, Nuevo cliente,
 * Registrar interacción y Registrar venta) son funcionales.
 */
export function AccionOverlay({
  abierta,
  onClose,
}: {
  abierta: Accion | null;
  onClose: () => void;
}) {
  return (
    <Sheet
      open={abierta !== null}
      onClose={onClose}
      title={abierta ? TITULOS[abierta] : ""}
    >
      {abierta === "tarea" ? (
        <NuevaTareaForm onDone={onClose} />
      ) : abierta === "cliente" ? (
        <NuevoClienteForm onDone={onClose} />
      ) : abierta === "interaccion" ? (
        <RegistrarInteraccionForm onDone={onClose} />
      ) : abierta === "venta" ? (
        <RegistrarVentaForm onDone={onClose} />
      ) : null}
    </Sheet>
  );
}
