// Model layer de autorización (RAU-87). Reemplaza la barrera temporal de
// RAU-67 (requireApiTemporalmenteHabilitada) por identidad real, mismo
// espíritu que crearCliente/avanzarFechaUltimoContacto en model/clientes.ts:
// lógica de negocio fuera de las mutations/queries finas.
import { ConvexError } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import type { Doc, Id } from "../_generated/dataModel";
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

// --- Login con Google, registro cerrado (RAU-213) --------------------------
// Sin registro público tampoco por Google: solo entra quien ya tiene un
// perfil `usuarios` provisionado (por el bootstrap de RAU-87 o la futura
// alta de RAU-111) cuyo email coincide con el de la cuenta de Google. Esta
// función sustituye por completo el enlace-por-email por defecto de
// @convex-dev/auth, que NO se ejecuta aquí porque `createOrUpdateUser` ya es
// un callback custom (convex/auth.ts) - verificado contra el código fuente
// de @convex-dev/auth (server/implementation/users.ts): el enlace por
// defecto solo corre cuando `config.callbacks.createOrUpdateUser` es
// `undefined`.
//
// `existingUserId` se revalida en CADA llamada, no solo quedan primer
// enlace: si viene no-null (ya existe una fila `authAccounts` para esta
// cuenta de Google), igual se vuelve a resolver el perfil por el email
// actual y se exige que `perfil.authUserId` siga siendo exactamente ese
// mismo usuario. Sin este chequeo, revocar el acceso de alguien (borrar su
// fila `usuarios` o reasignar el email a otra persona) no bastaría: su
// cuenta de Google ya vinculada seguiría entrando por el atajo de
// `existingUserId` en `createOrUpdateUser` (hallazgo de Auditoría, Plan
// nº 1 → nº 2 de RAU-213).
export async function vincularUsuarioGoogle(
  ctx: MutationCtx,
  existingUserId: Id<"users"> | null,
  profile: Record<string, unknown>,
): Promise<Id<"users">> {
  const email = typeof profile.email === "string" ? profile.email.trim() : "";
  if (!email) {
    throw new ConvexError("Acceso con Google rechazado: perfil sin email.");
  }
  // El `profile()` por defecto de @auth/core descarta `email_verified`;
  // convex/auth.ts define un `profile()` custom para el proveedor Google
  // que sí lo conserva - defensa en profundidad, ya que completar el
  // intercambio OAuth con Google ya implica una cuenta con email verificado
  // en la inmensa mayoría de los casos.
  if (profile.email_verified !== true) {
    throw new ConvexError("Acceso con Google rechazado: email no verificado.");
  }

  const perfil = await ctx.db
    .query("usuarios")
    .withIndex("by_email", (q) => q.eq("email", email))
    .unique();
  if (perfil === null) {
    throw new ConvexError(
      "Acceso no autorizado: tu cuenta de Google no corresponde a ningún usuario dado de alta en el CRM.",
    );
  }

  if (existingUserId !== null) {
    if (perfil.authUserId !== existingUserId) {
      throw new ConvexError(
        "Acceso no autorizado: el email ya no está vinculado a esta cuenta de Google.",
      );
    }
    return existingUserId;
  }

  // Primer login con Google para este perfil. Si ya tiene `authUserId`
  // (típicamente de su alta por contraseña, RAU-87), Google se enlaza a la
  // MISMA cuenta - createOrUpdateAccount (librería) crea la fila
  // `authAccounts` nueva con provider "google" sobre este `userId`, sin que
  // haga falta tocar nada más aquí.
  if (perfil.authUserId !== undefined) return perfil.authUserId;

  // Defensivo: perfil provisionado pero sin ninguna credencial todavía (no
  // ocurre hoy con Marta/Carlos, ambos ya tienen authUserId por el
  // bootstrap) - mismo patrón que el caso análogo de createOrUpdateUser
  // para el flujo de contraseña (convex/auth.ts).
  const userId = await ctx.db.insert("users", { email });
  await ctx.db.patch(perfil._id, { authUserId: userId });
  return userId;
}
