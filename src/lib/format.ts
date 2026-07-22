// Utilidades de formato/parseo de dinero PURAS (RAU-69), reutilizables (también por
// RAU-114). El importe del dominio es un entero de euros: el diseño no maneja céntimos.

/** Euros enteros → "€21.000" (símbolo delante, miles con puntos), como el diseño. */
export function formatoEuro(n: number): string {
  return "€" + String(Math.round(n || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

/** Techo de negocio del importe (evita además overflow de precisión). */
export const IMPORTE_MAX = 1_000_000_000;

/**
 * Texto crudo del input de importe → euros enteros. Tras recortar espacios externos, SOLO
 * acepta dígitos (entero en `1..IMPORTE_MAX`): rechaza signos, decimales, separadores de
 * miles, cualquier carácter extra y números demasiado grandes/no seguros devolviendo `null`
 * (no los reinterpreta, para no corromper importes). Devuelve `null` si vacío o no válido.
 */
export function parseImporteEuros(raw: string): number | null {
  const s = raw.trim();
  if (!/^\d+$/.test(s)) return null; // solo dígitos: sin '+/-', ',', '.', '€'…
  const n = Number(s);
  if (!Number.isSafeInteger(n) || n <= 0 || n > IMPORTE_MAX) return null;
  return n;
}
