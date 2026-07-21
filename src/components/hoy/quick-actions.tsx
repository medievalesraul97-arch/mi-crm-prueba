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
import { cn } from "@/lib/utils";

export type Accion = "tarea" | "interaccion" | "venta" | "cliente";

interface Tile {
  key: Accion;
  label: string;
  icon: LucideIcon;
  destacada?: boolean;
  rau?: string;
}

const TILES: Tile[] = [
  { key: "tarea", label: "Nueva tarea", icon: ClipboardList, destacada: true },
  { key: "interaccion", label: "Anotar interacción", icon: MessageSquare, rau: "RAU-116" },
  { key: "venta", label: "Registrar venta", icon: TrendingUp, rau: "RAU-69" },
  { key: "cliente", label: "Nuevo cliente", icon: UserPlus, rau: "RAU-66" },
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

/** Overlay de la acción abierta: Nueva tarea funcional; el resto, stub etiquetado. */
export function AccionOverlay({
  abierta,
  onClose,
}: {
  abierta: Accion | null;
  onClose: () => void;
}) {
  const rau = TILES.find((t) => t.key === abierta)?.rau;
  return (
    <Sheet
      open={abierta !== null}
      onClose={onClose}
      title={abierta ? TITULOS[abierta] : ""}
    >
      {abierta === "tarea" ? (
        <NuevaTareaForm onDone={onClose} />
      ) : (
        <p className="py-2 text-sm text-text-muted">
          Este formulario se implementa en {rau}. Abrirá el overlay con selector
          de cliente sobre los mismos datos.
        </p>
      )}
    </Sheet>
  );
}
