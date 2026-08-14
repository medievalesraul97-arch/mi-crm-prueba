// Model layer de autorización (RAU-87). Reemplaza la barrera temporal de
// RAU-67 (requireApiTemporalmenteHabilitada) por identidad real, mismo
// espíritu que crearCliente/avanzarFechaUltimoContacto en model/clientes.ts:
// lógica de negocio fuera de las mutations/queries finas.
import { ConvexError } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import type { Doc } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

/** Lanza si no hay sesión válida o no tiene perfil `usuarios` asociado.
 * Devuelve el perfil (nunca un id de argumento - invariante ya establecido
 * en RAU-67: no fiarse de ids que llegan del cliente para autorizar). */
export async function requireIdentity(
  ctx: QueryCtx | MutationCtx,
): Promise<Doc<"usuarios">> {
  const authUserId = await getAuthUserId(ctx);
  if (authUserId === null) throw new Error("401: no autenticado");

  const perfil = await ctx.db
    .query("usuarios")
    .withIndex("by_authUserId", (q) => q.eq("authUserId", authUserId))
    .unique();
  if (perfil === null) throw new Error("403: sin perfil CRM asociado");
  if (perfil.debeCambiarPassword) {
    throw new Error("403: debes cambiar tu contraseña antes de continuar");
  }
  return perfil;
}

/** Para mutations restringidas a la Dueña (RAU-88/RAU-111 las usarán). */
export async function requirePropietaria(
  ctx: QueryCtx | MutationCtx,
): Promise<Doc<"usuarios">> {
  const u = await requireIdentity(ctx);
  if (u.rol !== "propietaria") throw new Error("403: requiere rol propietaria");
  return u;
}

// --- Bootstrap admin-only de altas (RAU-87) --------------------------------
// Alta nueva sin registro público: solo válida con secreto de entorno +
// ventana de expiración + email en una lista cerrada. Compartido por
// createOrUpdateUser (alta, convex/auth.ts) y reemitirPasswordTemporal
// (reemisión, convex/usuarios.ts) - una sola fuente de verdad.
const EMAILS_BOOTSTRAP_PERMITIDOS = new Set([
  "marta@vibecrm.es",
  "carlos@vibecrm.es",
]);

/** 48h: suficiente para que dos personas coordinen su primer login sin
 * dejar una ventana de riesgo innecesariamente larga. */
export const TTL_PASSWORD_TEMPORAL_MS = 48 * 60 * 60 * 1000;

/** Lanza si no se cumplen las 3 condiciones de la ventana de bootstrap
 * (secreto, expiración, email permitido) - compartido por
 * createOrUpdateUser (alta) y reemitirPasswordTemporal (reemisión). */
export function requireVentanaBootstrap(
  bootstrapSecret: string | undefined,
  email: string,
): void {
  const expiraEn = Number(process.env.AUTH_BOOTSTRAP_EXPIRES_AT ?? 0);
  const dentroDeVentana = Number.isFinite(expiraEn) && Date.now() < expiraEn;
  if (
    !process.env.AUTH_BOOTSTRAP_SECRET ||
    bootstrapSecret !== process.env.AUTH_BOOTSTRAP_SECRET ||
    !dentroDeVentana ||
    !EMAILS_BOOTSTRAP_PERMITIDOS.has(email)
  ) {
    throw new ConvexError("Alta no permitida: falta autorización de administrador.");
  }
}

/** Fail-closed: con debeCambiarPassword=true, cuenta como caducado tanto
 * "ya venció" como "no tiene timestamp válido" - una cuenta pendiente sin
 * passwordTemporalExpiraEn NO debe tratarse como "aún dentro de plazo". */
export function passwordTemporalCaducada(perfil: {
  debeCambiarPassword?: boolean;
  passwordTemporalExpiraEn?: number;
}): boolean {
  if (!perfil.debeCambiarPassword) return false;
  const expiraEn = perfil.passwordTemporalExpiraEn;
  return !Number.isFinite(expiraEn) || Date.now() > (expiraEn as number);
}
