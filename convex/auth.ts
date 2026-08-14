// Autenticación real (RAU-87): proveedor Password de @convex-dev/auth. El
// diseño exige email+contraseña (no passkeys/OAuth) para las 2 personas
// reales del equipo. Sin registro público: el alta solo ocurre a través del
// bootstrap admin-only (ver scripts/bootstrap-admin.mjs), nunca desde la
// pantalla de login.
import { convexAuth } from "@convex-dev/auth/server";
import { Password } from "@convex-dev/auth/providers/Password";
import { ConvexError } from "convex/values";
import type { MutationCtx } from "./_generated/server";
import {
  passwordTemporalCaducada,
  requireVentanaBootstrap,
  TTL_PASSWORD_TEMPORAL_MS,
} from "./model/auth";

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    Password({
      profile(params) {
        // Asignado a variable (no literal): evita el excess-property-check
        // de TS para los campos que no están en `users` (nombre/rol/secreto
        // de bootstrap viajan como claves extra sueltas del objeto) - mismo
        // patrón que usa la propia librería internamente
        // (providers/Password.ts, `profile: profile as any`). Verificado
        // contra el código fuente de @convex-dev/auth (rama main) que estas
        // claves llegan intactas a createOrUpdateUser sin ningún filtrado:
        // un `callbacks.createOrUpdateUser` propio corta camino antes de la
        // ruta por defecto que sí filtraría contra el esquema de `users`.
        const extra = {
          email: params.email as string,
          nombre: params.nombre as string | undefined,
          rol: params.rol as "propietaria" | "comercial" | undefined,
          bootstrapSecret: params.bootstrapSecret as string | undefined,
        };
        // as any: el tipo de retorno declarado exige que cada clave extra
        // sea `Value` (sin `undefined`), pero nombre/rol/bootstrapSecret sí
        // pueden faltar - createOrUpdateUser los valida explícitamente.
        // Mismo cast que usa la propia librería para este mismo dato
        // (Password.ts: `profile: profile as any`).
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return extra as any;
      },
    }),
  ],
  callbacks: {
    async createOrUpdateUser(ctxGenerico, args) {
      // El ctx que entrega la librería está tipado como
      // GenericMutationCtx<AnyDataModel> (no conoce nuestro schema real,
      // @convex-dev/auth es un paquete genérico) - en runtime SÍ es
      // nuestro MutationCtx real (mismo ctx que cualquier mutation de este
      // backend), así que el cast es seguro. Sin él, `ctx.db.query("usuarios")
      // .withIndex(...)` no tipa contra nuestros índices reales.
      const ctx = ctxGenerico as unknown as MutationCtx;

      // Sign-in de una cuenta que ya existe: nada que crear.
      if (args.existingUserId) return args.existingUserId;

      // Alta nueva (flow "signUp"). `signIn` es una action PÚBLICA: sin
      // controles, cualquiera con la URL del deployment podría darse de
      // alta llamando a auth:signIn directamente, sin pasar por el login
      // (que nunca manda flow=signUp). Mismo patrón de barrera de entorno
      // que SEED_PERMITIDO (seed.ts) / CLIENTES_API_SIN_AUTH_PERMITIDO
      // (clientes.ts, RAU-67).
      //
      // Tres controles independientes, no solo el secreto: el script que
      // fija el secreto (scripts/bootstrap-admin.mjs) puede no llegar a
      // retirarlo (Ctrl+C, caída de Node/equipo, fallo de red) - estos dos
      // de abajo cierran la ventana igualmente aunque eso pase:
      //  (a) expiración corta comparada contra un timestamp NO sensible
      //      fijado junto al secreto (caduca sola, no depende de que nadie
      //      la borre);
      //  (b) lista cerrada de los 2 emails reales de este bootstrap - ni
      //      con el secreto en la mano sirve para dar de alta a nadie más.
      // Esta ruta entera es temporal: RAU-111 la sustituye por un alta real
      // desde la pantalla Equipo, gateada por rol, no por secreto.
      const p = args.profile as {
        email: string;
        nombre?: string;
        rol?: "propietaria" | "comercial";
        bootstrapSecret?: string;
      };

      requireVentanaBootstrap(p.bootstrapSecret, p.email);
      if (!p.nombre?.trim() || (p.rol !== "propietaria" && p.rol !== "comercial")) {
        throw new ConvexError("Alta inválida: faltan nombre o rol.");
      }

      const userId = await ctx.db.insert("users", { email: p.email });

      // Defensivo: puede existir ya un perfil `usuarios` con ese email sin
      // vincular a ninguna cuenta de auth (p. ej. sembrado por seed.ts en
      // la era pre-RAU-87, antes de que authUserId existiera). Vincularlo
      // en vez de duplicar - pero SIGUE contando como alta real: es la
      // primera vez que esa persona obtiene una credencial, así que exige
      // igualmente el cambio de contraseña inicial. Solo se omite ese
      // marcado si el perfil YA estaba vinculado a una cuenta de auth
      // (el bootstrap se corrió dos veces) - ahí no se toca
      // debeCambiarPassword/passwordTemporalExpiraEn para no pisar un
      // cambio ya completado.
      const existente = await ctx.db
        .query("usuarios")
        .withIndex("by_email", (q) => q.eq("email", p.email))
        .unique();
      if (existente !== null && existente.authUserId !== undefined) {
        await ctx.db.patch(existente._id, { authUserId: userId });
      } else if (existente !== null) {
        await ctx.db.patch(existente._id, {
          authUserId: userId,
          debeCambiarPassword: true,
          passwordTemporalExpiraEn: Date.now() + TTL_PASSWORD_TEMPORAL_MS,
        });
      } else {
        await ctx.db.insert("usuarios", {
          authUserId: userId,
          nombre: p.nombre.trim(),
          email: p.email,
          rol: p.rol,
          // Contraseña temporal (RAU-87 adenda): obliga a cambiarla en el
          // primer login antes de dejar pasar a AuthGate/requireIdentity.
          debeCambiarPassword: true,
          passwordTemporalExpiraEn: Date.now() + TTL_PASSWORD_TEMPORAL_MS,
        });
      }

      return userId;
    },
    async beforeSessionCreation(ctxGenerico, { userId }) {
      // Corre en todo login, justo antes de crear la sesión - lanzar
      // rechaza el sign-in. Cierra la ventana de la temporal aunque nadie
      // la cierre a mano (bootstrap-admin.mjs es limpieza de mejor
      // esfuerzo). Fail-closed vía passwordTemporalCaducada: un timestamp
      // ausente o no finito cuenta como caducado, no como "dentro de plazo".
      const ctx = ctxGenerico as unknown as MutationCtx;
      const perfil = await ctx.db
        .query("usuarios")
        .withIndex("by_authUserId", (q) => q.eq("authUserId", userId))
        .unique();
      if (perfil !== null && passwordTemporalCaducada(perfil)) {
        throw new Error(
          "La contraseña temporal ha caducado. Pide que te reemitan una nueva.",
        );
      }
    },
  },
});
