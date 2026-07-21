// Utilidades de fecha PURAS. Reciben `today` (inicio de día local) de forma
// explícita: nunca llaman a `new Date()` a nivel de módulo, para no introducir
// desajustes SSR/hidratación ni bugs de medianoche.

export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function addDays(base: Date, dias: number): Date {
  const d = startOfDay(base);
  d.setDate(d.getDate() + dias);
  return d;
}

/** Días completos entre dos fechas (hasta - desde), normalizando a inicio de día. */
export function diasEntre(desde: Date, hasta: Date): number {
  const ms = startOfDay(hasta).getTime() - startOfDay(desde).getTime();
  return Math.round(ms / 86_400_000);
}

export type Bucket = "atrasado" | "hoy" | "futuro";

export function bucket(vence: Date, today: Date): Bucket {
  const d = diasEntre(today, vence);
  if (d < 0) return "atrasado";
  if (d === 0) return "hoy";
  return "futuro";
}

/** Fecha de hoy en MAYÚSCULAS, p. ej. "MARTES, 21 DE JULIO". */
export function eyebrowHoy(today: Date): string {
  const fmt = new Intl.DateTimeFormat("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  return fmt.format(today).toUpperCase();
}

/** Texto relativo del vencimiento. Vacío si es futuro (no se muestra en Hoy). */
export function vencidoTexto(vence: Date, today: Date): string {
  const atraso = diasEntre(vence, today); // >0 => venció hace N días
  if (atraso < 0) return "";
  if (atraso === 0) return "Vence hoy";
  if (atraso === 1) return "Venció ayer";
  return `Venció hace ${atraso} días`;
}
