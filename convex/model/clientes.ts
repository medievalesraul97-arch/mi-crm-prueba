// Model layer de clientes (RAU-63). Funciones reutilizables que reciben el ctx
// de una mutation: aquí vive la lógica de negocio y las mutations quedan finas.
// Las tareas de pantalla (RAU-69/72/116) y los 3 disparadores de RAU-71 deben
// llamar a estas funciones en vez de duplicar la regla.
import type { WithoutSystemFields } from "convex/server";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";

/**
 * Datos de alta de un cliente. Derivado del esquema para no divergir de él:
 * las fechas no se aceptan del llamador salvo `fechaRegistro` opcional (altas
 * retrodatadas del seed); la issue las define automáticas al crear.
 */
export type NuevoCliente = Omit<
  WithoutSystemFields<Doc<"clientes">>,
  "fechaRegistro" | "fechaUltimoContacto"
> & { fechaRegistro?: number };

/**
 * Crea un cliente aplicando el caso "recién creado" de RAU-71:
 * `fechaUltimoContacto` arranca igual a `fechaRegistro`.
 */
export async function crearCliente(
  ctx: MutationCtx,
  datos: NuevoCliente,
): Promise<Id<"clientes">> {
  const fechaRegistro = datos.fechaRegistro ?? Date.now();
  return await ctx.db.insert("clientes", {
    ...datos,
    fechaRegistro,
    fechaUltimoContacto: fechaRegistro,
  });
}

/**
 * Regla central de RAU-71: `fechaUltimoContacto` solo avanza, nunca retrocede.
 * Comparación con `>` estricto (el provider mock usa `>=`): con fecha igual el
 * estado final es idéntico y así se evita una escritura no-op. Devuelve si
 * llegó a escribir. Los 3 disparadores (interacción registrada, venta
 * registrada, seguimiento completado) se conectarán aquí en RAU-71.
 */
export async function avanzarFechaUltimoContacto(
  ctx: MutationCtx,
  clienteId: Id<"clientes">,
  fecha: number,
): Promise<boolean> {
  const cliente = await ctx.db.get(clienteId);
  if (cliente === null) {
    throw new Error(`El cliente ${clienteId} no existe`);
  }
  if (fecha <= cliente.fechaUltimoContacto) {
    return false;
  }
  await ctx.db.patch(clienteId, { fechaUltimoContacto: fecha });
  return true;
}
