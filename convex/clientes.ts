// API pública de clientes (RAU-67): crear, listar, obtener, actualizar.
// Primera función pública de Convex del repo - hasta ahora solo existían
// schema + model layer (RAU-63). Conectar la UI a estas funciones queda
// fuera de alcance (tarea futura); esto es solo la capa de datos.
//
// SEGURIDAD (ver plan RAU-67): estas 4 funciones NO tienen autorización real
// (ctx.auth) porque no existe autenticación todavía (RAU-87, sin empezar).
// requireApiTemporalmenteHabilitada() es una barrera de entorno TEMPORAL,
// aceptada por la Auditoría solo para un deployment dev aislado y sin datos
// reales - no es autorización ni sustituye a RAU-87. Retirar esta barrera y
// sustituirla por ctx.auth/requireIdentity en cuanto RAU-87 esté implementado.
import { v, ConvexError } from "convex/values";
import { mutation, query } from "./_generated/server";
import schema from "./schema";
import {
  clienteValidator,
  crearCliente,
  normalizarDatosCliente,
  soloDigitos,
  validarClienteAlta,
  validarClienteEdicion,
} from "./model/clientes";

// Barrera temporal: lanza si no está explícitamente habilitada - no hay `if`
// que los handlers puedan olvidar, porque no exponemos un boolean, exponemos
// el throw.
function requireApiTemporalmenteHabilitada(): void {
  if (process.env.CLIENTES_API_SIN_AUTH_PERMITIDO !== "true") {
    throw new Error(
      "API de clientes deshabilitada: falta autorización real (RAU-87). " +
        "Definir CLIENTES_API_SIN_AUTH_PERMITIDO=true solo en el deployment dev.",
    );
  }
}

// Validadores de las entidades asociadas a la ficha (para `obtener`).
// Derivados del schema igual que clienteValidator: cero duplicación de
// campos. No hay model layer propio para estas 3 entidades - fuera de
// alcance de esta issue (solo lectura aquí, ninguna mutation las escribe).
const interaccionValidator = schema.tables.interacciones.validator.extend({
  _id: v.id("interacciones"),
  _creationTime: v.number(),
});
const ventaValidator = schema.tables.ventas.validator.extend({
  _id: v.id("ventas"),
  _creationTime: v.number(),
});
const seguimientoValidator = schema.tables.seguimientos.validator.extend({
  _id: v.id("seguimientos"),
  _creationTime: v.number(),
});

export const crear = mutation({
  args: {
    nombre: v.string(),
    empresa: v.optional(v.string()),
    email: v.optional(v.string()),
    telefono: v.optional(v.string()),
    canalOrigen: v.optional(
      v.union(
        v.literal("web"),
        v.literal("redes"),
        v.literal("email"),
        v.literal("whatsapp"),
      ),
    ),
    nota: v.optional(v.string()),
  },
  returns: clienteValidator,
  handler: async (ctx, args) => {
    requireApiTemporalmenteHabilitada();

    const normalizado = normalizarDatosCliente(args);
    const nota = args.nota?.trim() || undefined;
    const errors = validarClienteAlta({ ...normalizado, nota });
    if (Object.keys(errors).length > 0) {
      throw new ConvexError({ errors });
    }

    // verificarLimiteFuncionalClientes vive dentro de crearCliente (model
    // layer): cubre también a seed.ts y a cualquier otro llamador, no solo
    // a esta mutation (ver plan RAU-67).
    const id = await crearCliente(ctx, {
      nombre: normalizado.nombre,
      empresa: normalizado.empresa,
      estado: "nuevo",
      telefono: normalizado.telefono,
      email: normalizado.email,
      canalOrigen: args.canalOrigen,
      nota,
    });

    const doc = await ctx.db.get(id);
    if (doc === null) {
      throw new Error(`Invariante roto: el cliente ${id} recién creado no existe`);
    }
    return doc;
  },
});

export const listar = query({
  args: { busqueda: v.optional(v.string()) },
  returns: v.array(clienteValidator),
  handler: async (ctx, args) => {
    requireApiTemporalmenteHabilitada();

    // Seguro sin ningún chequeo adicional aquí: crearCliente ya garantiza el
    // límite funcional en escritura para cualquier llamador (ver plan RAU-67).
    const clientes = await ctx.db
      .query("clientes")
      .withIndex("by_fechaUltimoContacto")
      .order("desc")
      .collect();

    const termino = (args.busqueda ?? "").trim().toLowerCase();
    if (!termino) return clientes;

    const terminoDigitos = soloDigitos(termino);
    return clientes.filter((c) => {
      if (c.nombre.toLowerCase().includes(termino)) return true;
      if ((c.email ?? "").toLowerCase().includes(termino)) return true;
      if (
        terminoDigitos.length > 1 &&
        soloDigitos(c.telefono ?? "").includes(terminoDigitos)
      )
        return true;
      return false;
    });
  },
});

export const obtener = query({
  args: { id: v.id("clientes") },
  returns: v.union(
    v.null(),
    v.object({
      cliente: clienteValidator,
      interacciones: v.array(interaccionValidator),
      ventas: v.array(ventaValidator),
      seguimientos: v.object({
        pendientes: v.array(seguimientoValidator),
        completados: v.array(seguimientoValidator),
      }),
    }),
  ),
  handler: async (ctx, args) => {
    requireApiTemporalmenteHabilitada();

    const cliente = await ctx.db.get(args.id);
    if (cliente === null) return null;

    // Acotado por la propia query (índice con `fecha` como segundo campo):
    // "hasta las 500 más recientes", no "todas".
    const interacciones = await ctx.db
      .query("interacciones")
      .withIndex("by_cliente_fecha", (q) => q.eq("clienteId", args.id))
      .order("desc")
      .take(500);
    const ventas = await ctx.db
      .query("ventas")
      .withIndex("by_cliente_fecha", (q) => q.eq("clienteId", args.id))
      .order("desc")
      .take(500);

    // Sin límite (`.collect()`): by_cliente no tiene campo de orden, así que
    // un `.take()` aquí cortaría antes de aplicar el criterio real
    // (pendientes por vence asc, completados por fechaHecho desc) - ver plan
    // RAU-67. Seguro porque hoy ninguna mutation de este repo escribe en
    // seguimientos (RAU-72/113 sin contraparte Convex; solo seed.ts inserta
    // un puñado fijo). Condición temporal: la tarea que añada la primera
    // mutation de seguimientos debe incorporar su propio límite funcional.
    const todosLosSeguimientos = await ctx.db
      .query("seguimientos")
      .withIndex("by_cliente", (q) => q.eq("clienteId", args.id))
      .collect();
    const pendientes = todosLosSeguimientos
      .filter((s) => !s.hecho)
      .sort((a, b) => a.vence - b.vence);
    const completados = todosLosSeguimientos
      .filter((s) => s.hecho)
      .sort((a, b) => (b.fechaHecho ?? b.vence) - (a.fechaHecho ?? a.vence));

    return {
      cliente,
      interacciones,
      ventas,
      seguimientos: { pendientes, completados },
    };
  },
});

export const actualizar = mutation({
  args: {
    id: v.id("clientes"),
    nombre: v.string(),
    empresa: v.optional(v.string()),
    email: v.optional(v.string()),
    telefono: v.optional(v.string()),
    estado: v.union(
      v.literal("nuevo"),
      v.literal("negociacion"),
      v.literal("pendiente"),
      v.literal("ganado"),
      v.literal("perdido"),
    ),
  },
  returns: clienteValidator,
  handler: async (ctx, args) => {
    requireApiTemporalmenteHabilitada();

    const existente = await ctx.db.get(args.id);
    if (existente === null) {
      throw new Error(`El cliente ${args.id} no existe`);
    }

    const normalizado = normalizarDatosCliente(args);
    const errors = validarClienteEdicion(normalizado);
    if (Object.keys(errors).length > 0) {
      throw new ConvexError({ errors });
    }

    await ctx.db.patch(args.id, {
      nombre: normalizado.nombre,
      empresa: normalizado.empresa,
      email: normalizado.email,
      telefono: normalizado.telefono,
      estado: args.estado,
    });

    const actualizado = await ctx.db.get(args.id);
    if (actualizado === null) {
      throw new Error(
        `Invariante roto: el cliente ${args.id} desapareció durante la actualización`,
      );
    }
    return actualizado;
  },
});
