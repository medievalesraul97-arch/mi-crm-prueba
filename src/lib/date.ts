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

/** Texto relativo del último contacto: Hoy / Ayer / Hace N días / Hace N semanas. */
export function ultimoContactoTexto(fecha: Date, today: Date): string {
  const d = diasEntre(fecha, today); // días transcurridos desde `fecha` (>0 = pasado)
  if (d <= 0) return "Hoy";
  if (d === 1) return "Ayer";
  if (d < 7) return `Hace ${d} días`;
  const w = Math.round(d / 7);
  return `Hace ${w} ${w === 1 ? "semana" : "semanas"}`;
}

/** Texto relativo del vencimiento. Vacío si es futuro (no se muestra en Hoy). */
export function vencidoTexto(vence: Date, today: Date): string {
  const atraso = diasEntre(vence, today); // >0 => venció hace N días
  if (atraso < 0) return "";
  if (atraso === 0) return "Vence hoy";
  if (atraso === 1) return "Venció ayer";
  return `Venció hace ${atraso} días`;
}

/**
 * Como `vencidoTexto` pero también cubre el futuro ("Vence el <fecha>"): lo usa
 * la ficha de cliente, que lista TODOS los pendientes (incluidos los próximos).
 */
export function vencimientoTexto(vence: Date, today: Date): string {
  const atraso = diasEntre(vence, today); // >0 => venció hace N días
  if (atraso > 1) return `Venció hace ${atraso} días`;
  if (atraso === 1) return "Venció ayer";
  if (atraso === 0) return "Vence hoy";
  return `Vence el ${fechaCorta(vence)}`;
}

/** Fecha corta local, p. ej. "22 jul" (día + mes abreviado). */
export function fechaCorta(fecha: Date): string {
  return new Intl.DateTimeFormat("es-ES", {
    day: "numeric",
    month: "short",
  }).format(fecha);
}

/** Fecha a `YYYY-MM-DD` local, para el `value` de un `<input type="date">`. */
export function isoDeFecha(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

/** Parsea `YYYY-MM-DD` (de un `<input type="date">`) a `Date` local, o `null`. */
export function parseFecha(v: string): Date | null {
  if (!v) return null;
  const [y, m, d] = v.split("-").map(Number);
  if (!y || !m || !d) return null;
  const fecha = new Date(y, m - 1, d);
  // Rechaza fechas imposibles (p. ej. "2026-02-31", que haría rollover a marzo).
  // El <input type="date"> nunca las produce, pero endurece el uso programático.
  if (
    fecha.getFullYear() !== y ||
    fecha.getMonth() !== m - 1 ||
    fecha.getDate() !== d
  )
    return null;
  return fecha;
}
