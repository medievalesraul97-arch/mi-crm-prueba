"use client";

import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { CheckRedondo } from "./check-redondo";
import { bucket, vencidoTexto } from "@/lib/date";
import { ESTADO_CLIENTE_BADGE } from "@/components/ui/estado-badge";
import type { SeguimientoEnriquecido } from "@/lib/types";
import { cn } from "@/lib/utils";

interface SeguimientoItemProps {
  seguimiento: SeguimientoEnriquecido;
  today: Date;
  onToggle: (id: string) => void;
  onAbrirFicha: (clienteId: string) => void;
}

export function SeguimientoItem({
  seguimiento,
  today,
  onToggle,
  onAbrirFicha,
}: SeguimientoItemProps) {
  const { id, accion, vence, cliente, responsable } = seguimiento;
  const estado = ESTADO_CLIENTE_BADGE[cliente.estado];
  const texto = vencidoTexto(vence, today);
  const atrasado = bucket(vence, today) === "atrasado";

  return (
    <div className="flex items-center gap-3 border-b border-border py-3 last:border-b-0">
      <CheckRedondo
        checked={seguimiento.hecho}
        onChange={() => onToggle(id)}
        label={`Marcar como hecho: ${accion}`}
      />
      <button
        type="button"
        onClick={() => onAbrirFicha(cliente.id)}
        className="flex min-w-0 flex-1 items-center gap-3 rounded-md text-left"
      >
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="truncate text-[15px] font-medium text-text">
              {cliente.nombre}
            </span>
            <Badge tone={estado.tone} className="shrink-0">
              {estado.label}
            </Badge>
          </span>
          <span className="mt-0.5 block truncate text-[13px] text-text-muted">
            {accion}
          </span>
        </span>
        <Avatar
          name={responsable.nombre}
          variant="neutral"
          className="hidden h-8 w-8 text-[11px] sm:flex"
        />
        {texto && (
          <span
            className={cn(
              "shrink-0 font-mono text-[13px] tabular-nums",
              atrasado ? "text-error-text" : "text-text-muted",
            )}
          >
            {texto}
          </span>
        )}
      </button>
    </div>
  );
}
