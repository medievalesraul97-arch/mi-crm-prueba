import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

// Esquema de Vibe CRM. Traduce los tipos de `src/lib/types.ts` al modelo de datos
// de Convex. Convenciones:
//  - El identificador lo aporta Convex como `_id` (no declaramos `id`).
//  - Las fechas se guardan como `number` (epoch en ms), no como `Date`.
//  - Las relaciones usan `v.id("<tabla>")` en vez de strings sueltas.
//  - `_creationTime` es automático; aun así conservamos las fechas de negocio
//    que la UI necesita explícitamente (p. ej. `fechaRegistro`).

export default defineSchema({
  // Usuarios del CRM (RAU-75/87). Personas: Marta (propietaria) y Carlos (comercial).
  usuarios: defineTable({
    nombre: v.string(),
    email: v.string(),
    rol: v.union(v.literal("propietaria"), v.literal("comercial")),
  }).index("by_email", ["email"]),

  // Clientes / oportunidades (RAU-65/66/68).
  clientes: defineTable({
    nombre: v.string(),
    empresa: v.optional(v.string()),
    estado: v.union(
      v.literal("nuevo"),
      v.literal("negociacion"),
      v.literal("ganado"),
      v.literal("perdido"),
    ),
    telefono: v.optional(v.string()),
    email: v.optional(v.string()),
    canalOrigen: v.optional(
      v.union(
        v.literal("web"),
        v.literal("redes"),
        v.literal("email"),
        v.literal("whatsapp"),
      ),
    ),
    nota: v.optional(v.string()),
    fechaRegistro: v.optional(v.number()),
    fechaUltimoContacto: v.optional(v.number()),
  }).index("by_estado", ["estado"]),

  // Seguimientos / tareas por cliente (RAU-68/72/113).
  seguimientos: defineTable({
    clienteId: v.id("clientes"),
    accion: v.string(),
    vence: v.number(),
    hecho: v.boolean(),
    fechaHecho: v.optional(v.number()),
    responsableId: v.id("usuarios"),
  })
    .index("by_cliente", ["clienteId"])
    .index("by_responsable", ["responsableId"]),

  // Interacciones registradas por cliente (RAU-116).
  interacciones: defineTable({
    clienteId: v.id("clientes"),
    canal: v.union(
      v.literal("llamada"),
      v.literal("email"),
      v.literal("whatsapp"),
      v.literal("en_persona"),
    ),
    texto: v.string(),
    fecha: v.number(),
    autorId: v.id("usuarios"),
  }).index("by_cliente", ["clienteId"]),

  // Ventas / oportunidades cerradas por cliente (RAU-69).
  ventas: defineTable({
    clienteId: v.id("clientes"),
    concepto: v.string(),
    // Euros enteros (el diseño no maneja céntimos).
    importe: v.number(),
    estado: v.union(
      v.literal("abierta"),
      v.literal("ganada"),
      v.literal("perdida"),
    ),
    fecha: v.number(),
    autorId: v.id("usuarios"),
  }).index("by_cliente", ["clienteId"]),
});
