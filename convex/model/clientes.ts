// Model layer de clientes (RAU-63, ampliado en RAU-67). Funciones reutilizables
// que reciben el ctx de una mutation: aquí vive la lógica de negocio de
// clientes; las mutations de convex/clientes.ts quedan finas. Las tareas de
// pantalla (RAU-69/72/116) y los 3 disparadores de RAU-71 deben llamar a estas
// funciones en vez de duplicar la regla.
//
// OJO: crearCliente NO valida "al menos teléfono o email" (schema.ts documenta
// esa regla como responsabilidad de las mutations, no del esquema, y solo se
// exige en la creación - ver schema.ts). El llamador debe validar antes de
// llamar con validarClienteAlta (más abajo). Sí aplica, en cambio, el límite
// funcional de volumen (verificarLimiteFuncionalClientes): vive dentro de
// crearCliente, no en la mutation pública, para cubrir también a seed.ts y a
// cualquier otro llamador del model layer (plan RAU-67, ronda 6).
import { v } from "convex/values";
import type { WithoutSystemFields } from "convex/server";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import schema from "../schema";

/** Validador de un doc completo de "clientes" (con _id/_creationTime), derivado
 * del propio schema para no duplicar sus campos. Fuente única para los 4
 * `returns` de convex/clientes.ts (RAU-67). */
export const clienteValidator = schema.tables.clientes.validator.extend({
  _id: v.id("clientes"),
  _creationTime: v.number(),
});

/** Dígitos de un texto, para comparar teléfonos ignorando espacios/símbolos.
 * Espejo deliberado de `soloDigitos` en clientes-client.tsx / `normPhone` del
 * diseño; no se importa desde src/ (mismo motivo que seed.ts: no acoplar el
 * backend al frontend mock que se retirará al conectar la UI a Convex). */
export function soloDigitos(s: string): string {
  return s.replace(/[^0-9]/g, "");
}

const MAX_NOMBRE = 200;
const MAX_EMPRESA = 200;
const MAX_EMAIL = 254; // tope práctico de RFC 5321
const MAX_TELEFONO = 32; // ningún formato internacional real se acerca
const MAX_NOTA = 2000;

function normalizarTexto(s: string | undefined): string | undefined {
  const t = (s ?? "").trim();
  return t.length > 0 ? t : undefined;
}

/** Única función de normalización de contacto (RAU-67), usada tanto para
 * validar como para insertar/patchear: recorta espacios; campos opcionales
 * vacíos tras trim() se devuelven undefined (nunca cadena vacía en BD). */
export function normalizarDatosCliente(datos: {
  nombre: string;
  empresa?: string;
  email?: string;
  telefono?: string;
}): {
  nombre: string;
  empresa?: string;
  email?: string;
  telefono?: string;
} {
  return {
    nombre: datos.nombre.trim(),
    empresa: normalizarTexto(datos.empresa),
    email: normalizarTexto(datos.email),
    telefono: normalizarTexto(datos.telefono),
  };
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface ErroresClienteAlta {
  // Index signature: permite pasar este objeto directo a `new ConvexError({
  // errors })`, que exige un `Value` (JSON) con firma de índice string.
  [key: string]: string | undefined;
  nombre?: string;
  empresa?: string;
  email?: string;
  telefono?: string;
  contacto?: string;
  nota?: string;
}

/**
 * Validación pura del alta de cliente (RAU-66/67), sobre datos YA
 * normalizados (normalizarDatosCliente + normalizarTexto para `nota`).
 * Réplica de `validarCliente` de app-data-provider.tsx más los límites de
 * longitud. Rechaza, no trunca. Devuelve `{}` si no hay errores.
 */
export function validarClienteAlta(datos: {
  nombre: string;
  empresa?: string;
  email?: string;
  telefono?: string;
  nota?: string;
}): ErroresClienteAlta {
  const errors: ErroresClienteAlta = {};
  if (!datos.nombre) errors.nombre = "Añade un nombre";
  else if (datos.nombre.length > MAX_NOMBRE)
    errors.nombre = `El nombre no puede superar los ${MAX_NOMBRE} caracteres`;
  if (datos.empresa && datos.empresa.length > MAX_EMPRESA)
    errors.empresa = `La empresa no puede superar los ${MAX_EMPRESA} caracteres`;
  if (datos.email && !EMAIL_RE.test(datos.email)) errors.email = "Email no válido";
  else if (datos.email && datos.email.length > MAX_EMAIL)
    errors.email = `El email no puede superar los ${MAX_EMAIL} caracteres`;
  if (datos.telefono && datos.telefono.length > MAX_TELEFONO)
    errors.telefono = `El teléfono no puede superar los ${MAX_TELEFONO} caracteres`;
  if (!datos.telefono && !datos.email)
    errors.contacto = "Indica al menos un teléfono o un email";
  if (datos.nota && datos.nota.length > MAX_NOTA)
    errors.nota = `La nota no puede superar los ${MAX_NOTA} caracteres`;
  return errors;
}

export interface ErroresClienteEdicion {
  [key: string]: string | undefined;
  nombre?: string;
  empresa?: string;
  email?: string;
  telefono?: string;
}

/**
 * Validación pura de edición de cliente (RAU-67), sobre datos YA
 * normalizados. Solo nombre obligatorio + límites de longitud + formato de
 * email; NO re-exige "al menos un contacto" (regla explícita de la issue
 * para `actualizar` - ver invariante aclarado en schema.ts). Rechaza, no
 * trunca. Devuelve `{}` si no hay errores.
 */
export function validarClienteEdicion(datos: {
  nombre: string;
  empresa?: string;
  email?: string;
  telefono?: string;
}): ErroresClienteEdicion {
  const errors: ErroresClienteEdicion = {};
  if (!datos.nombre) errors.nombre = "Añade un nombre";
  else if (datos.nombre.length > MAX_NOMBRE)
    errors.nombre = `El nombre no puede superar los ${MAX_NOMBRE} caracteres`;
  if (datos.empresa && datos.empresa.length > MAX_EMPRESA)
    errors.empresa = `La empresa no puede superar los ${MAX_EMPRESA} caracteres`;
  if (datos.email && !EMAIL_RE.test(datos.email)) errors.email = "Email no válido";
  else if (datos.email && datos.email.length > MAX_EMAIL)
    errors.email = `El email no puede superar los ${MAX_EMAIL} caracteres`;
  if (datos.telefono && datos.telefono.length > MAX_TELEFONO)
    errors.telefono = `El teléfono no puede superar los ${MAX_TELEFONO} caracteres`;
  return errors;
}

/**
 * Tope deliberadamente conservador (no la cota real de la plataforma
 * Convex, que este repo no puede verificar) - ver plan RAU-67 para la
 * aritmética de bytes en el peor caso con los MAX_* de arriba (~11 KB/doc
 * en el peor caso absoluto; 200 docs =~ 2.2 MiB, muy por debajo de
 * cualquier límite de lectura por función que quepa esperar de Convex).
 * Disparador documentado para pasar a paginación real (.paginate() +
 * searchIndex): acercarse a este límite en producción.
 */
const LIMITE_FUNCIONAL_CLIENTES = 200;

/**
 * Garantiza, ANTES de insertar, que la tabla "clientes" no crece más allá
 * de LIMITE_FUNCIONAL_CLIENTES - lectura acotada de verdad (`.take`, nunca
 * `.collect()`). Vive dentro de crearCliente (no en la mutation pública)
 * para cubrir también a seed.ts y a cualquier otro llamador del model
 * layer: es el único punto de la API donde se inserta en "clientes", así
 * que es el único sitio donde hace falta el guard para que sea un
 * invariante real (plan RAU-67, ronda 6).
 */
async function verificarLimiteFuncionalClientes(ctx: MutationCtx): Promise<void> {
  const primeros = await ctx.db
    .query("clientes")
    .withIndex("by_fechaUltimoContacto")
    .take(LIMITE_FUNCIONAL_CLIENTES + 1);
  if (primeros.length > LIMITE_FUNCIONAL_CLIENTES) {
    throw new Error(
      `No se puede crear: se alcanzó el límite funcional de ` +
        `${LIMITE_FUNCIONAL_CLIENTES} clientes sin paginación real (RAU-67).`,
    );
  }
}

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
 * `fechaUltimoContacto` arranca igual a `fechaRegistro`. No valida `datos`
 * (ver nota de cabecera): el llamador es responsable de esa validación. Sí
 * aplica el límite funcional de volumen (ver verificarLimiteFuncionalClientes)
 * antes de insertar.
 */
export async function crearCliente(
  ctx: MutationCtx,
  datos: NuevoCliente,
): Promise<Id<"clientes">> {
  await verificarLimiteFuncionalClientes(ctx);
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
