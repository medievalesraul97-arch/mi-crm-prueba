import type { BadgeTone } from "@/components/ui/badge";
import type { EstadoVenta } from "@/lib/types";

/**
 * Mapa de presentación: estado de venta (dominio) -> etiqueta + tono del `Badge`. Vive en
 * la capa de UI para no acoplar `lib/types` a la presentación (como `ESTADO_CLIENTE_BADGE`).
 */
export const ESTADO_VENTA_BADGE: Record<
  EstadoVenta,
  { label: string; tone: BadgeTone }
> = {
  abierta: { label: "Oportunidad abierta", tone: "info" },
  ganada: { label: "Ganada", tone: "success" },
  perdida: { label: "Perdida", tone: "error" },
};

/**
 * Color del importe de una venta en el historial, por estado. Clases Tailwind LITERALES
 * (no dinámicas `text-${tone}-text`, que el JIT no detecta de forma fiable). Colores del
 * prototipo (`histVenta`): abierta `--color-text`, ganada/perdida el `-text` de su tono.
 */
export const IMPORTE_VENTA_CLASE: Record<EstadoVenta, string> = {
  abierta: "text-text",
  ganada: "text-success-text",
  perdida: "text-error-text",
};
