import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

// Esquema de Vibe CRM (RAU-63). Traduce los tipos de `src/lib/types.ts` al
// modelo de datos de Convex. Convenciones:
//  - El identificador lo aporta Convex como `_id` (no declaramos `id`).
//  - Las fechas se guardan como `number` (epoch en ms), no como `Date`.
//  - Las relaciones usan `v.id("<tabla>")` en vez de strings sueltas.
//  - `_creationTime` es automático y cubre la `fecha_creacion` conceptual de la
//    issue; aun así conservamos las fechas de negocio que la UI necesita
//    explícitamente (p. ej. `fechaRegistro`).
//
// Naming: la issue RAU-63 documenta los campos en snake_case conceptual; aquí
// se usa el español camelCase del resto del repo. Equivalencias: nuevo_lead→
// nuevo, en_negociacion→negociacion, canal_origen→canalOrigen,
// fecha_vencimiento→vence, fecha_hecho→fechaHecho, fecha_creacion→_creationTime.
//
// Desviaciones deliberadas respecto a la issue (acordadas el 14/8/2026):
//  - `usuarios` sin password_hash: el login real (bcrypt) llega en RAU-87.
//  - `clientes` sin prioridad: campo y migración llegan en RAU-90.
//
// INVARIANTE OBLIGATORIO para toda mutation futura (RAU-69/72/116…):
// `v.id("tabla")` valida formato y tabla del ID, pero NO que el documento
// exista. Toda mutation que reciba ids debe hacer `ctx.db.get(...)` y rechazar
// el ausente (patrón de referencia: `avanzarFechaUltimoContacto` en
// model/clientes.ts).
//
// Reglas de negocio que el esquema NO puede expresar y viven en mutations:
//  - unicidad de `usuarios.email` (chequear con el índice by_email; RAU-87/111)
//  - cliente con al menos teléfono o email; importe de venta > 0 y <= 1e9
//    (validaciones puras ya existentes en app-data-provider.tsx / format.ts)
//  - no eliminar el último usuario con rol "propietaria" (RAU-88/RAU-111)
//
// Migraciones: el criterio "versionadas y reversibles" de la issue queda
// DIFERIDO en RAU-63 (revertir schema.ts en git no transforma datos ya
// escritos: Convex rechazaría el push del esquema anterior). Mientras no haya
// datos reales de producción, los cambios de esquema serán solo
// aditivos/opcionales (expand, nunca contract); antes del primer cambio sobre
// datos vivos (o del lanzamiento a producción) se adopta @convex-dev/migrations
// con backfill y reversa definidos.

export default defineSchema({
  // Usuarios del CRM (RAU-75/87). Personas: Marta (propietaria) y Carlos (comercial).
  usuarios: defineTable({
    nombre: v.string(),
    email: v.string(),
    rol: v.union(v.literal("propietaria"), v.literal("comercial")),
  })
    // Login por email (RAU-87) y chequeo de unicidad en las mutations de alta.
    .index("by_email", ["email"]),

  // Clientes / oportunidades (RAU-65/66/68).
  clientes: defineTable({
    nombre: v.string(),
    empresa: v.optional(v.string()),
    estado: v.union(
      v.literal("nuevo"),
      v.literal("negociacion"),
      v.literal("pendiente"),
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
    // Obligatorias: las fija `crearCliente` (model/clientes.ts) al crear.
    // `fechaUltimoContacto` arranca igual a `fechaRegistro` y solo avanza
    // (regla RAU-71, helper `avanzarFechaUltimoContacto`).
    fechaRegistro: v.number(),
    fechaUltimoContacto: v.number(),
  })
    // Filtro por estado de la lista de clientes (prototipo del MVP).
    .index("by_estado", ["estado"])
    // /clientes ordena por último contacto desc (clientes-client.tsx).
    .index("by_fechaUltimoContacto", ["fechaUltimoContacto"]),
  // Sin searchIndex: la búsqueda actual cruza nombre+email+teléfono y un
  // searchIndex solo admite un campo; a escala MVP se filtra en memoria.
  // Se decidirá en la tarea que conecte la pantalla de clientes.

  // Seguimientos / tareas por cliente (RAU-68/72/113).
  seguimientos: defineTable({
    clienteId: v.id("clientes"),
    accion: v.string(),
    // manual: creado por una persona; automatico: lo creará el job de avisos a
    // 15 días con la propietaria como responsable.
    origen: v.union(v.literal("manual"), v.literal("automatico")),
    vence: v.number(),
    hecho: v.boolean(),
    fechaHecho: v.optional(v.number()),
    responsableId: v.id("usuarios"),
  })
    // Ficha del cliente (ordena en memoria: pendientes y completados usan
    // órdenes distintos y el volumen por cliente es mínimo).
    .index("by_cliente", ["clienteId"])
    // /hoy: pendientes (hecho=false) ya ordenados por vencimiento.
    .index("by_hecho_vence", ["hecho", "vence"]),
  // `by_responsable` se retiró del borrador: ninguna pantalla actual consulta
  // por responsable; si RAU-113 lo necesita, añadirlo es una línea.

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
  })
    // Ficha: por cliente, fecha desc. `fecha` es de negocio y retrodatable,
    // así que `_creationTime` no sirve como orden.
    .index("by_cliente_fecha", ["clienteId", "fecha"]),

  // Ventas / oportunidades cerradas por cliente (RAU-69).
  ventas: defineTable({
    clienteId: v.id("clientes"),
    concepto: v.string(),
    // Euros enteros (el diseño no maneja céntimos). Importe > 0 y tope 1e9 se
    // validan en las mutations (parseImporteEuros en src/lib/format.ts).
    importe: v.number(),
    estado: v.union(
      v.literal("abierta"),
      v.literal("ganada"),
      v.literal("perdida"),
    ),
    fecha: v.number(),
    autorId: v.id("usuarios"),
  })
    // Ficha: por cliente, fecha desc.
    .index("by_cliente_fecha", ["clienteId", "fecha"])
    // /ventas: listado global por fecha desc.
    .index("by_fecha", ["fecha"]),
});
