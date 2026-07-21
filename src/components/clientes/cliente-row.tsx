"use client";

import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ESTADO_CLIENTE_BADGE } from "@/components/ui/estado-badge";
import { ultimoContactoTexto } from "@/lib/date";
import type { Cliente } from "@/lib/types";

interface ClienteRowProps {
  cliente: Cliente;
  today: Date | null;
  onAbrirFicha: (clienteId: string) => void;
}

/** Fila de la lista de clientes: avatar + nombre + estado + último contacto. */
export function ClienteRow({ cliente, today, onAbrirFicha }: ClienteRowProps) {
  const estado = ESTADO_CLIENTE_BADGE[cliente.estado];
  // Tolerante a fecha ausente (no rompemos aunque entre un cliente incompleto).
  const ultimo =
    cliente.fechaUltimoContacto && today
      ? ultimoContactoTexto(cliente.fechaUltimoContacto, today)
      : "—";

  return (
    <button
      type="button"
      onClick={() => onAbrirFicha(cliente.id)}
      className="flex w-full items-center gap-3 border-b border-border px-4 py-3.5 text-left last:border-b-0 hover:bg-surface-2"
    >
      <Avatar name={cliente.nombre} />
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
          Último contacto: {ultimo}
        </span>
      </span>
    </button>
  );
}
