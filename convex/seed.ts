// Seed de verificación para RAU-63: demuestra que las 5 entidades se pueden
// crear con sus relaciones y ejercita el helper de fechaUltimoContacto
// (model/clientes.ts) en sus dos ramas ("avanza" / "no retrocede").
// `usuarios` es la excepción desde RAU-87: no se crea aquí, se busca (ver
// más abajo) - las cuentas reales las crea el bootstrap de autenticación.
//
// Autocontenido a propósito: replica (no importa) las semillas de
// `src/lib/mock/data.ts:46-106`, cuyos comentarios documentan los invariantes
// de consistencia que este seed respeta (interacción/venta más reciente de un
// cliente nunca posterior a su fechaUltimoContacto). No se importa desde
// `src/` para no acoplar el backend al mock, que se retirará al conectar la
// UI a Convex.
//
// Uso: `npx convex run seed:ejecutar` (sin args) crea los datos si las tablas
// están vacías; con `{"sobrescribir": true}` borra todo y recrea.
import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { avanzarFechaUltimoContacto, crearCliente } from "./model/clientes";

// `usuarios` NO está aquí a propósito (RAU-87): su ciclo de vida ya no lo
// controla este seed, lo controla el bootstrap de autenticación
// (scripts/bootstrap-admin.mjs + convex/auth.ts) - un reseed no debe borrar
// las cuentas de login reales de Marta y Carlos.
const TABLAS = [
  "clientes",
  "seguimientos",
  "interacciones",
  "ventas",
] as const;

// Único punto de acceso a la variable de entorno: evita typos de nombre
// dispersos por el backend. Convex 1.42 no ofrece declaración tipada de
// variables de entorno en convex.config.ts (reservado a componentes).
function seedPermitido(): boolean {
  return process.env.SEED_PERMITIDO === "true";
}

export const ejecutar = internalMutation({
  args: { sobrescribir: v.optional(v.boolean()) },
  returns: v.object({
    usuarios: v.number(),
    clientes: v.number(),
    seguimientos: v.number(),
    interacciones: v.number(),
    ventas: v.number(),
  }),
  handler: async (ctx, { sobrescribir }) => {
    // Barrera de entorno: condición de Go de la Auditoría. Este seed borra
    // datos con `sobrescribir: true`; solo puede correr donde la variable
    // SEED_PERMITIDO=true esté definida explícitamente (dev). En producción
    // no se define nunca, así que la función queda inerte aunque esté
    // desplegada y se invoque por CLI o Dashboard con credenciales de prod.
    if (!seedPermitido()) {
      throw new Error(
        "Seed deshabilitado en este deployment. Solo dev: " +
          "npx convex env set SEED_PERMITIDO true",
      );
    }

    const yaHayDatos = await Promise.all(
      TABLAS.map(async (tabla) => (await ctx.db.query(tabla).first()) !== null),
    );
    if (yaHayDatos.some(Boolean)) {
      if (!sobrescribir) {
        throw new Error(
          'Ya hay datos. Ejecuta con \'{"sobrescribir": true}\' para borrar y recrear.',
        );
      }
      // `.collect()` sin índice es intencional: un borrado total necesita
      // TODAS las filas, no un subconjunto filtrable por índice. Acotado por
      // el tamaño de los datos de seed (~20 docs en las 5 tablas juntas),
      // muy por debajo del límite de 8192 writes por mutation de Convex; no
      // usar este seed para vaciar tablas con datos reales de producción
      // (bloqueado además por la barrera SEED_PERMITIDO).
      for (const tabla of TABLAS) {
        const docs = await ctx.db.query(tabla).collect();
        for (const doc of docs) await ctx.db.delete(doc._id);
      }
    }

    const ahora = Date.now();
    const diasAtras = (n: number) => ahora - n * 86_400_000;

    // --- usuarios -----------------------------------------------------
    // Ya NO se insertan aquí: las cuentas reales las crea el bootstrap de
    // autenticación (RAU-87, scripts/bootstrap-admin.mjs + convex/auth.ts).
    // Este seed las busca por email y falla con un mensaje claro si el
    // bootstrap no se ha ejecutado todavía.
    const uMartaPerfil = await ctx.db
      .query("usuarios")
      .withIndex("by_email", (q) => q.eq("email", "marta@vibecrm.es"))
      .unique();
    const uCarlosPerfil = await ctx.db
      .query("usuarios")
      .withIndex("by_email", (q) => q.eq("email", "carlos@vibecrm.es"))
      .unique();
    if (uMartaPerfil === null || uCarlosPerfil === null) {
      throw new Error(
        "Ejecuta primero el bootstrap de autenticación (RAU-87, ver " +
          "scripts/bootstrap-admin.mjs) para crear a Marta y Carlos antes " +
          "de sembrar el resto de datos.",
      );
    }
    const uMarta = uMartaPerfil._id;
    const uCarlos = uCarlosPerfil._id;

    // --- clientes -----------------------------------------------------
    // fechaRegistro es una elección solo-seed (el mock no la define): alta
    // ~30 días antes del último contacto. avanzarFechaUltimoContacto se llama
    // después para dejar el estado final igual al mock, ejercitando la rama
    // "avanza" del helper.
    const clientesSemilla = [
      { id: "c-1", nombre: "Laura Sánchez", empresa: "Estudio Nórdico", estado: "negociacion" as const, telefono: "+34 600 123 456", email: "laura@estudionordico.es", ultimoContactoOffset: 0 },
      { id: "c-2", nombre: "Diego Fernández", empresa: "Cafés del Sur", estado: "nuevo" as const, telefono: "+34 611 222 333", email: "diego@cafesdelsur.com", ultimoContactoOffset: 1 },
      { id: "c-3", nombre: "Ana Torres", empresa: "Torres & Co", estado: "ganado" as const, telefono: "+34 622 333 444", email: "ana@torresyco.es", ultimoContactoOffset: 3 },
      { id: "c-4", nombre: "Javier Molina", estado: "negociacion" as const, telefono: "+34 633 444 555", email: "javier.molina@gmail.com", ultimoContactoOffset: 6 },
      { id: "c-5", nombre: "Marina López", empresa: "Diseño Aurora", estado: "nuevo" as const, telefono: "+34 644 555 666", email: "marina@disenoaurora.es", ultimoContactoOffset: 10 },
      { id: "c-6", nombre: "Pablo Herrero", empresa: "Herrero Legal", estado: "perdido" as const, telefono: "+34 655 666 777", email: "pablo@herrerolegal.es", ultimoContactoOffset: 25 },
    ];
    const idsClientes: Record<string, Id<"clientes">> = {};
    for (const c of clientesSemilla) {
      const id = await crearCliente(ctx, {
        nombre: c.nombre,
        empresa: c.empresa,
        estado: c.estado,
        telefono: c.telefono,
        email: c.email,
        fechaRegistro: diasAtras(c.ultimoContactoOffset + 30),
      });
      await avanzarFechaUltimoContacto(ctx, id, diasAtras(c.ultimoContactoOffset));
      idsClientes[c.id] = id;
    }
    // 7.º cliente, exclusivo del seed: ejercita el 5.º valor del enum
    // ("pendiente", exigido por la issue y ausente del mock de src/) y los
    // campos opcionales canalOrigen/nota con un insert real.
    const idClientePendiente = await crearCliente(ctx, {
      nombre: "Carlos Ruiz",
      empresa: "Beta Digital",
      estado: "pendiente",
      telefono: "+34 611 445 667",
      email: "carlos@betadigital.com",
      canalOrigen: "email",
      nota: "Pendiente de decisión, evaluando presupuesto.",
      fechaRegistro: diasAtras(38),
    });
    await avanzarFechaUltimoContacto(ctx, idClientePendiente, diasAtras(8));

    // --- seguimientos ---------------------------------------------------
    // Los seguimientos NO tocan fechaUltimoContacto al crearse (regla de
    // dominio: solo lo hace completarlos, RAU-71). Todos con origen "manual":
    // el origen "automatico" lo generará el job de avisos, fuera de alcance.
    const seguimientosSemilla = [
      { clienteId: "c-1", accion: "Llamar para cerrar la propuesta", venceOffset: -3, responsableId: uMarta },
      { clienteId: "c-2", accion: "Enviar el catálogo por email", venceOffset: -1, responsableId: uCarlos },
      { clienteId: "c-4", accion: "Confirmar la reunión de la semana", venceOffset: -1, responsableId: uMarta },
      { clienteId: "c-3", accion: "Preparar la factura del pedido", venceOffset: 0, responsableId: uMarta },
      { clienteId: "c-5", accion: "Responder dudas sobre el plan", venceOffset: 0, responsableId: uCarlos },
      { clienteId: "c-6", accion: "Seguimiento tras la reunión", venceOffset: 3, responsableId: uCarlos },
      { clienteId: "c-1", accion: "Agradecer la última compra", venceOffset: -5, hecho: true, responsableId: uMarta },
    ];
    for (const s of seguimientosSemilla) {
      const hecho = s.hecho ?? false;
      await ctx.db.insert("seguimientos", {
        clienteId: idsClientes[s.clienteId],
        accion: s.accion,
        origen: "manual",
        vence: diasAtras(-s.venceOffset),
        hecho,
        fechaHecho: hecho ? ahora : undefined,
        responsableId: s.responsableId,
      });
    }

    // --- interacciones ----------------------------------------------------
    // i-2 (offset 5, más antigua que el último contacto de c-1) ejercita la
    // rama "no retrocede" del helper; i-1 (offset 0) deja el estado igual.
    const interaccionesSemilla = [
      { clienteId: "c-1", canal: "llamada" as const, texto: "Llamada para repasar la propuesta; le encaja el presupuesto, pide un par de ajustes.", fechaOffset: 0, autorId: uMarta },
      { clienteId: "c-1", canal: "email" as const, texto: "Enviado el catálogo actualizado por email tras la feria.", fechaOffset: 5, autorId: uCarlos },
    ];
    for (const i of interaccionesSemilla) {
      const clienteId = idsClientes[i.clienteId];
      const fecha = diasAtras(i.fechaOffset);
      await ctx.db.insert("interacciones", {
        clienteId,
        canal: i.canal,
        texto: i.texto,
        fecha,
        autorId: i.autorId,
      });
      await avanzarFechaUltimoContacto(ctx, clienteId, fecha);
    }

    // --- ventas -------------------------------------------------------
    // Los offsets son >= el ultimoContactoOffset de su cliente (invariante de
    // src/lib/mock/data.ts:86-90): ninguna venta retrocede fechaUltimoContacto.
    const ventasSemilla = [
      { clienteId: "c-3", concepto: "Licencia anual Enterprise", importe: 21000, estado: "ganada" as const, fechaOffset: 12, autorId: uCarlos },
      { clienteId: "c-1", concepto: "Servicio de configuración inicial", importe: 1200, estado: "ganada" as const, fechaOffset: 17, autorId: uMarta },
      { clienteId: "c-4", concepto: "Formación del equipo", importe: 1500, estado: "abierta" as const, fechaOffset: 30, autorId: uCarlos },
    ];
    for (const venta of ventasSemilla) {
      const clienteId = idsClientes[venta.clienteId];
      const fecha = diasAtras(venta.fechaOffset);
      await ctx.db.insert("ventas", {
        clienteId,
        concepto: venta.concepto,
        importe: venta.importe,
        estado: venta.estado,
        fecha,
        autorId: venta.autorId,
      });
      await avanzarFechaUltimoContacto(ctx, clienteId, fecha);
    }

    return {
      usuarios: 2,
      clientes: clientesSemilla.length + 1,
      seguimientos: seguimientosSemilla.length,
      interacciones: interaccionesSemilla.length,
      ventas: ventasSemilla.length,
    };
  },
});
