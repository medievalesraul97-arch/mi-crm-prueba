// API pública de usuarios (RAU-87): listar el equipo, obtener el perfil del
// usuario autenticado y el flujo de contraseña temporal con cambio
// obligatorio (bootstrap admin-only, ver scripts/bootstrap-admin.mjs).
import {
  getAuthSessionId,
  getAuthUserId,
  invalidateSessions,
  modifyAccountCredentials,
} from "@convex-dev/auth/server";
import { ConvexError, v } from "convex/values";
import { action, internalMutation, internalQuery, query } from "./_generated/server";
import { internal } from "./_generated/api";
import {
  passwordTemporalCaducada,
  requireIdentity,
  requireVentanaBootstrap,
  TTL_PASSWORD_TEMPORAL_MS,
} from "./model/auth";

// Mismo mínimo que exige el diseño para "Cambiar contraseña" (RAU-112, CRM
// Shell.dc.html ~línea 1207: "Mínimo 6 caracteres") - distinto del mínimo de
// 8 que aplica por defecto la librería SOLO dentro del flujo público
// signIn/signUp; aquí no pasa por esa ruta (modifyAccountCredentials no
// valida nada por sí sola).
const MIN_PASSWORD = 6;

const usuarioValidator = v.object({
  _id: v.id("usuarios"),
  _creationTime: v.number(),
  nombre: v.string(),
  email: v.string(),
  rol: v.union(v.literal("propietaria"), v.literal("comercial")),
  debeCambiarPassword: v.boolean(),
});

export const listar = query({
  args: {},
  returns: v.array(usuarioValidator),
  handler: async (ctx) => {
    await requireIdentity(ctx); // cualquier persona autenticada ve al equipo
    // 2 filas hoy; sin índice de orden porque no hace falta (ver plan
    // RAU-67 para el criterio de cuándo un .collect() necesita límite).
    const todos = await ctx.db.query("usuarios").collect();
    // Explícito en vez de destructuring-omit (authUserId es un detalle
    // interno de enlace con `users`, no algo que el frontend necesite).
    return todos.map((u) => ({
      _id: u._id,
      _creationTime: u._creationTime,
      nombre: u.nombre,
      email: u.email,
      rol: u.rol,
      debeCambiarPassword: u.debeCambiarPassword ?? false,
    }));
  },
});

export const obtenerActual = query({
  args: {},
  returns: v.union(v.null(), usuarioValidator),
  handler: async (ctx) => {
    const authUserId = await getAuthUserId(ctx);
    if (authUserId === null) return null; // sin sesión, no es un error
    const perfil = await ctx.db
      .query("usuarios")
      .withIndex("by_authUserId", (q) => q.eq("authUserId", authUserId))
      .unique();
    if (perfil === null) return null; // sesión válida pero bootstrap no corrido
    return {
      _id: perfil._id,
      _creationTime: perfil._creationTime,
      nombre: perfil.nombre,
      email: perfil.email,
      rol: perfil.rol,
      debeCambiarPassword: perfil.debeCambiarPassword ?? false,
    };
  },
});

export const perfilPorAuthUserId = internalQuery({
  args: { authUserId: v.id("users") },
  returns: v.union(
    v.null(),
    v.object({
      _id: v.id("usuarios"),
      email: v.string(),
      debeCambiarPassword: v.boolean(),
      // cambiarPasswordInicial debe poder comprobar la caducidad por sí
      // misma, no solo confiar en que beforeSessionCreation ya la filtró
      // al crear la sesión (una sesión abierta antes de caducar podía
      // seguir llamando a esta action después de vencido el plazo).
      passwordTemporalExpiraEn: v.optional(v.number()),
    }),
  ),
  handler: async (ctx, { authUserId }) => {
    const perfil = await ctx.db
      .query("usuarios")
      .withIndex("by_authUserId", (q) => q.eq("authUserId", authUserId))
      .unique();
    return perfil
      ? {
          _id: perfil._id,
          email: perfil.email,
          debeCambiarPassword: perfil.debeCambiarPassword ?? false,
          passwordTemporalExpiraEn: perfil.passwordTemporalExpiraEn,
        }
      : null;
  },
});

export const marcarPasswordCambiada = internalMutation({
  args: { usuarioId: v.id("usuarios") },
  returns: v.null(),
  handler: async (ctx, { usuarioId }) => {
    await ctx.db.patch(usuarioId, { debeCambiarPassword: false });
    return null;
  },
});

/**
 * Cambia la contraseña del usuario autenticado - SOLO si el cambio sigue
 * pendiente (RAU-87, cambio obligatorio tras el bootstrap). Sin "contraseña
 * actual": el caller ya se autenticó con la temporal para llegar aquí. NO
 * es un "cambiar contraseña" autoservicio de uso general (eso es RAU-112,
 * que sí pedirá la actual) - una vez usada una vez, deja de funcionar.
 */
export const cambiarPasswordInicial = action({
  args: { nuevaPassword: v.string() },
  returns: v.null(),
  handler: async (ctx, { nuevaPassword }) => {
    const authUserId = await getAuthUserId(ctx);
    if (authUserId === null) throw new Error("401: no autenticado");
    if (nuevaPassword.length < MIN_PASSWORD) {
      throw new ConvexError({
        errors: { nuevaPassword: `Mínimo ${MIN_PASSWORD} caracteres` },
      });
    }

    const perfil = await ctx.runQuery(internal.usuarios.perfilPorAuthUserId, {
      authUserId,
    });
    if (perfil === null) throw new Error("403: sin perfil CRM asociado");
    // Sin esto, cualquier sesión ya autenticada podía volver a llamar a
    // esta action para fijar una contraseña nueva sin aportar la actual,
    // incluso después de completar el cambio inicial.
    if (!perfil.debeCambiarPassword) {
      throw new Error("403: el cambio de contraseña inicial ya se completó");
    }
    // beforeSessionCreation solo bloquea sesiones NUEVAS pasadas las 48h -
    // una sesión ya abierta antes de la caducidad podía seguir llamando a
    // esta action después de vencido el plazo. Mismo helper fail-closed
    // que beforeSessionCreation (una sola fuente de verdad).
    if (passwordTemporalCaducada(perfil)) {
      throw new ConvexError(
        "La contraseña temporal ha caducado. Pide que te reemitan una nueva.",
      );
    }

    // Orden pensado para que ningún fallo a partir de aquí deje una sesión
    // antigua (p. ej. una abierta con la temporal por alguien que no era el
    // destinatario legítimo) con acceso ya autorizado:
    //  1. Exigir sessionIdActual - si faltara, invalidar "todas menos
    //     ninguna" cerraría también la sesión que está completando el
    //     cambio; mejor fallar aquí que arriesgar ese caso.
    //  2. Invalidar el resto de sesiones PRIMERO. Si esto falla, nada más
    //     ha cambiado todavía - recuperable sin más reintentando.
    //  3. Cambiar la credencial.
    //  4. Marcar debeCambiarPassword: false AL FINAL. Si (3) o (4) fallan,
    //     la cuenta queda "pendiente" (requireIdentity la sigue
    //     bloqueando, la sesión actual puede reintentar) - nunca con
    //     sesiones antiguas ya autorizadas de más.
    const sessionIdActual = await getAuthSessionId(ctx);
    if (sessionIdActual === null) throw new Error("401: sesión inválida");

    await invalidateSessions(ctx, {
      userId: authUserId,
      except: [sessionIdActual],
    });

    await modifyAccountCredentials(ctx, {
      provider: "password",
      account: { id: perfil.email, secret: nuevaPassword },
    });

    await ctx.runMutation(internal.usuarios.marcarPasswordCambiada, {
      usuarioId: perfil._id,
    });
    return null;
  },
});

export const perfilPorEmailPendiente = internalQuery({
  args: { email: v.string() },
  returns: v.union(
    v.null(),
    v.object({ _id: v.id("usuarios"), authUserId: v.union(v.id("users"), v.null()) }),
  ),
  handler: async (ctx, { email }) => {
    const perfil = await ctx.db
      .query("usuarios")
      .withIndex("by_email", (q) => q.eq("email", email))
      .unique();
    // Solo reemite cuentas con el cambio todavía pendiente - no tiene
    // sentido "reemitir" una contraseña para alguien que ya la cambió.
    if (perfil === null || !perfil.debeCambiarPassword) return null;
    return { _id: perfil._id, authUserId: perfil.authUserId ?? null };
  },
});

export const reemitirVentanaTemporal = internalMutation({
  args: { usuarioId: v.id("usuarios") },
  returns: v.null(),
  handler: async (ctx, { usuarioId }) => {
    await ctx.db.patch(usuarioId, {
      passwordTemporalExpiraEn: Date.now() + TTL_PASSWORD_TEMPORAL_MS,
    });
    return null;
  },
});

/**
 * Reemite una contraseña temporal para una cuenta cuyo cambio sigue
 * pendiente (p. ej. la anterior caducó sin usarse). Admin-gated con el
 * mismo secreto/ventana/email que el alta (`requireVentanaBootstrap`), no
 * con una sesión - la cuenta afectada puede no tener ninguna sesión válida
 * en este momento.
 */
export const reemitirPasswordTemporal = action({
  args: {
    email: v.string(),
    nuevaPasswordTemporal: v.string(),
    bootstrapSecret: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, { email, nuevaPasswordTemporal, bootstrapSecret }) => {
    requireVentanaBootstrap(bootstrapSecret, email);
    // A diferencia de cambiarPasswordInicial, esta action no comprobaba la
    // longitud mínima de la temporal.
    if (nuevaPasswordTemporal.length < MIN_PASSWORD) {
      throw new ConvexError({
        errors: { nuevaPasswordTemporal: `Mínimo ${MIN_PASSWORD} caracteres` },
      });
    }

    const perfil = await ctx.runQuery(internal.usuarios.perfilPorEmailPendiente, {
      email,
    });
    if (perfil === null) {
      throw new Error("No hay ninguna cuenta pendiente de cambio con ese email.");
    }

    // Mismo principio que cambiarPasswordInicial: invalidar primero, para
    // que un fallo posterior nunca deje una sesión antigua (abierta con la
    // temporal que se está reemitiendo, p. ej. tras una filtración) con
    // acceso vigente. Si los pasos siguientes fallan, el peor caso es una
    // reemisión a medias (recuperable repitiéndola) - nunca una sesión
    // antigua activa.
    if (perfil.authUserId !== null) {
      await invalidateSessions(ctx, { userId: perfil.authUserId });
    }

    await modifyAccountCredentials(ctx, {
      provider: "password",
      account: { id: email, secret: nuevaPasswordTemporal },
    });

    await ctx.runMutation(internal.usuarios.reemitirVentanaTemporal, {
      usuarioId: perfil._id,
    });
    return null;
  },
});
