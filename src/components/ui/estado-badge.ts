import type { BadgeTone } from "@/components/ui/badge";
import type { EstadoCliente } from "@/lib/types";

/**
 * Mapa de presentación: estado de cliente (dominio) -> etiqueta + tono del
 * `Badge`. Vive en la capa de UI para no acoplar `lib/types` a la presentación.
 */
export const ESTADO_CLIENTE_BADGE: Record<
  EstadoCliente,
  { label: string; tone: BadgeTone }
> = {
  nuevo: { label: "Nuevo lead", tone: "info" },
  negociacion: { label: "En negociación", tone: "primary" },
  ganado: { label: "Ganado", tone: "success" },
  perdido: { label: "Perdido", tone: "error" },
};
