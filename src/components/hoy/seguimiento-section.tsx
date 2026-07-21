"use client";

import { Card } from "@/components/ui/card";
import { SeguimientoItem } from "./seguimiento-item";
import { cn } from "@/lib/utils";
import type { SeguimientoEnriquecido } from "@/lib/types";

interface SeguimientoSectionProps {
  titulo: string;
  tone: "error" | "primary";
  items: SeguimientoEnriquecido[];
  today: Date;
  onToggle: (id: string) => void;
  onAbrirFicha: (clienteId: string) => void;
}

export function SeguimientoSection({
  titulo,
  tone,
  items,
  today,
  onToggle,
  onAbrirFicha,
}: SeguimientoSectionProps) {
  if (items.length === 0) return null;

  return (
    <Card className={cn("p-0", tone === "error" && "border-error")}>
      <div className="flex items-center gap-2 px-5 pb-1 pt-4">
        <span
          className={cn(
            "h-[7px] w-[7px] rounded-full",
            tone === "error" ? "bg-error" : "bg-primary",
          )}
        />
        <h2 className="text-[15px] font-semibold text-text">{titulo}</h2>
        <span className="font-mono text-[13px] tabular-nums text-text-muted">
          {items.length}
        </span>
      </div>
      <div className="px-5 pb-2">
        {items.map((s) => (
          <SeguimientoItem
            key={s.id}
            seguimiento={s}
            today={today}
            onToggle={onToggle}
            onAbrirFicha={onAbrirFicha}
          />
        ))}
      </div>
    </Card>
  );
}
