"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useAction, useConvexAuth, useQuery } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { ConvexError } from "convex/values";
import { api } from "../../../convex/_generated/api";
import type {
  CanalInteraccion,
  CanalOrigen,
  Cliente,
  EstadoVenta,
  Interaccion,
  InteraccionEnriquecida,
  Seguimiento,
  SeguimientoEnriquecido,
  Usuario,
  Venta,
  VentaEnriquecida,
} from "@/lib/types";
import {
  CLIENTES_SEMILLA,
  INTERACCIONES_SEMILLA,
  SEGUIMIENTOS_SEMILLA,
  USUARIOS,
  VENTAS_SEMILLA,
} from "@/lib/mock/data";
import { addDays, bucket, startOfDay } from "@/lib/date";
import { parseImporteEuros } from "@/lib/format";

export interface CrearSeguimientoInput {
  clienteId: string;
  accion: string;
  vence: Date | null;
  /** Responsable elegido (RAU-72). Opcional: si falta o es inválido, cae al de sesión. */
  responsableId?: string;
}

export interface ErroresSeguimiento {
  clienteId?: string;
  accion?: string;
  vence?: string;
}

export type CrearSeguimientoResultado =
  | { ok: true }
  | { ok: false; errors: ErroresSeguimiento };

export interface CrearClienteInput {
  nombre: string;
  empresa: string;
  telefono: string;
  email: string;
  canalOrigen: CanalOrigen | null;
  nota: string;
}

export interface ErroresCliente {
  nombre?: string;
  email?: string;
  contacto?: string;
}

export type CrearClienteResultado =
  | { ok: true; cliente: Cliente }
  | { ok: false; errors: ErroresCliente };

export interface RegistrarInteraccionInput {
  clienteId: string;
  canal: CanalInteraccion;
  texto: string;
  fecha: Date | null;
}

export interface ErroresInteraccion {
  clienteId?: string;
  canal?: string;
  texto?: string;
  fecha?: string;
}

export type RegistrarInteraccionResultado =
  | { ok: true }
  | { ok: false; errors: ErroresInteraccion };

export interface RegistrarVentaInput {
  clienteId: string;
  concepto: string;
  /** Texto crudo del input; el validador y la mutación lo parsean con `parseImporteEuros`. */
  importe: string;
  estado: EstadoVenta;
  fecha: Date | null;
}

export interface ErroresVenta {
  clienteId?: string;
  concepto?: string;
  importe?: string;
  fecha?: string;
}

export type RegistrarVentaResultado =
  | { ok: true }
  | { ok: false; errors: ErroresVenta };

export type LoginResultado = { ok: true } | { ok: false; error: string };

export type CambiarPasswordInicialResultado =
  | { ok: true }
  | { ok: false; error: string };

interface AppData {
  /** `true` hasta que el cliente resuelve `today` + fechas (evita mismatch SSR). */
  loading: boolean;
  /** `true` cuando ya se resolvió el estado de sesión real (Convex Auth, RAU-87) - para el gate de auth. */
  authLoaded: boolean;
  today: Date | null;
  clientes: Cliente[];
  usuarios: Usuario[];
  /** Usuario con sesión iniciada (autenticación real, RAU-87), o `null` si no hay sesión. */
  currentUser: Usuario | null;
  /** Cierto si el usuario autenticado tiene pendiente el cambio obligatorio
   * de contraseña temporal (RAU-87 adenda) - `false` sin sesión. */
  debeCambiarPassword: boolean;
  atrasados: SeguimientoEnriquecido[];
  paraHoy: SeguimientoEnriquecido[];
  pendientesCount: number;
  /**
   * Seguimientos de un cliente para su ficha (RAU-68): TODOS los pendientes
   * (cualquier bucket, incluidos los futuros) + los completados, ya enriquecidos
   * y ordenados. Distinto de `atrasados`/`paraHoy`, que excluyen los futuros.
   */
  seguimientosDeCliente: (clienteId: string) => {
    pendientes: SeguimientoEnriquecido[];
    completados: SeguimientoEnriquecido[];
  };
  marcarHecho: (id: string) => void;
  deshacer: (id: string) => void;
  crearSeguimiento: (input: CrearSeguimientoInput) => CrearSeguimientoResultado;
  /** Alta de cliente (RAU-66). Valida nombre + (teléfono o email) + email válido. */
  crearCliente: (input: CrearClienteInput) => CrearClienteResultado;
  /** Interacciones registradas (RAU-116), en memoria. */
  interacciones: Interaccion[];
  /** Interacciones de un cliente para su ficha: enriquecidas y desc por fecha. */
  interaccionesDeCliente: (clienteId: string) => InteraccionEnriquecida[];
  /** Registra una interacción (RAU-116) y avanza `fechaUltimoContacto` del cliente. */
  registrarInteraccion: (
    input: RegistrarInteraccionInput,
  ) => RegistrarInteraccionResultado;
  /** Ventas registradas (RAU-69), en memoria. */
  ventas: Venta[];
  /** Ventas de un cliente para su ficha: enriquecidas y desc por fecha. */
  ventasDeCliente: (clienteId: string) => VentaEnriquecida[];
  /** Registra una venta (RAU-69) y avanza `fechaUltimoContacto` del cliente. */
  registrarVenta: (input: RegistrarVentaInput) => RegistrarVentaResultado;
  /** Login real (RAU-87, Convex Auth Password). Async: hace una llamada de red. */
  login: (email: string, password: string) => Promise<LoginResultado>;
  /** Inicia el login con Google (RAU-213): redirige el navegador a Google.
   * El resultado (éxito/rechazo) vuelve a `/login` por URL, no por el valor
   * resuelto de esta promesa - ver `completarLoginGoogle`. */
  loginConGoogle: () => Promise<LoginResultado>;
  /** Completa el login con Google tras volver de Google con `?code=` en la
   * URL (RAU-213). Rechaza con el mismo shape que `login` si el código ya
   * no es válido (reintento, expirado). */
  completarLoginGoogle: (code: string) => Promise<LoginResultado>;
  logout: () => Promise<void>;
  /** Cambio obligatorio de la contraseña temporal (RAU-87 adenda). Sin
   * "contraseña actual": solo funciona mientras debeCambiarPassword es
   * cierto (ver convex/usuarios.ts, cambiarPasswordInicial). */
  cambiarPasswordInicial: (
    nuevaPassword: string,
  ) => Promise<CambiarPasswordInicialResultado>;
}

const AppDataContext = createContext<AppData | null>(null);

export function useAppData(): AppData {
  const ctx = useContext(AppDataContext);
  if (!ctx) throw new Error("useAppData debe usarse dentro de <AppDataProvider>");
  return ctx;
}

const validEmail = (email: string): boolean =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

let seq = 0;
function nuevoId(): string {
  seq += 1;
  return `s-nuevo-${Date.now()}-${seq}`;
}

let seqCliente = 0;
function nuevoClienteId(): string {
  seqCliente += 1;
  return `c-nuevo-${Date.now()}-${seqCliente}`;
}

let seqInteraccion = 0;
function nuevoInteraccionId(): string {
  seqInteraccion += 1;
  return `i-nuevo-${Date.now()}-${seqInteraccion}`;
}

let seqVenta = 0;
function nuevoVentaId(): string {
  seqVenta += 1;
  return `v-nuevo-${Date.now()}-${seqVenta}`;
}

/** Canales de interacción válidos, para validar defensivamente en el provider. */
const CANALES_INTERACCION: readonly CanalInteraccion[] = [
  "llamada",
  "email",
  "whatsapp",
  "en_persona",
];

/** Estados de venta válidos, para validar defensivamente en el provider. */
const ESTADOS_VENTA_VALIDOS: readonly EstadoVenta[] = [
  "abierta",
  "ganada",
  "perdida",
];

/**
 * Validación pura del alta de cliente (RAU-66), compartida por `crearCliente` y
 * el formulario (errores en vivo tras el primer intento). Fuente única de verdad
 * para no divergir. Devuelve `{}` si no hay errores.
 */
export function validarCliente(input: CrearClienteInput): ErroresCliente {
  const nombre = input.nombre.trim();
  const email = input.email.trim();
  const telefono = input.telefono.trim();

  const errors: ErroresCliente = {};
  if (!nombre) errors.nombre = "Añade un nombre";
  if (email && !validEmail(email)) errors.email = "Email no válido";
  if (!telefono && !email)
    errors.contacto = "Indica al menos un teléfono o un email";
  return errors;
}

/**
 * Validación pura del registro de interacción (RAU-116), compartida por
 * `registrarInteraccion` y el formulario (errores en vivo tras el primer intento).
 * Fuente única de verdad. Recibe `hoy` (inicio de día) para el chequeo de fecha
 * futura. No comprueba la existencia del cliente (eso lo hace la mutación, que sí
 * tiene el mapa de clientes). Devuelve `{}` si no hay errores.
 */
export function validarInteraccion(
  input: RegistrarInteraccionInput,
  hoy: Date,
): ErroresInteraccion {
  const errors: ErroresInteraccion = {};
  if (!input.clienteId) errors.clienteId = "Elige un cliente";
  if (!CANALES_INTERACCION.includes(input.canal)) errors.canal = "Elige un canal";
  if (!input.texto.trim()) errors.texto = "Escribe qué pasó";
  if (!input.fecha) errors.fecha = "Indica una fecha";
  else if (startOfDay(input.fecha) > hoy)
    errors.fecha = "La fecha no puede ser futura";
  return errors;
}

/**
 * Validación pura de la creación de seguimiento (RAU-72), compartida por
 * `crearSeguimiento` y el formulario (errores en vivo tras el primer intento).
 * Fuente única de verdad. No comprueba la existencia del cliente ni la validez del
 * responsable (eso lo hace la mutación, que sí tiene los mapas). Sin chequeo de
 * fecha futura: un seguimiento vence en el futuro por diseño. Devuelve `{}` si no
 * hay errores.
 */
export function validarSeguimiento(
  input: CrearSeguimientoInput,
): ErroresSeguimiento {
  const errors: ErroresSeguimiento = {};
  if (!input.clienteId) errors.clienteId = "Elige un cliente";
  if (!input.accion.trim()) errors.accion = "Indica qué hay que hacer";
  if (!input.vence) errors.vence = "Indica una fecha";
  return errors;
}

/**
 * Validación pura del registro de venta (RAU-69), compartida por `registrarVenta` y el
 * formulario (errores en vivo tras el primer intento). Fuente única de verdad. Recibe `hoy`
 * (que debe llegar YA normalizado a inicio de día, p. ej. `today ?? startOfDay(new Date())`)
 * para el chequeo de fecha futura. No comprueba la existencia del cliente (eso lo hace la
 * mutación) ni valida `estado` (siempre tiene valor del radiogroup). Devuelve `{}` si no hay
 * errores.
 */
export function validarVenta(
  input: RegistrarVentaInput,
  hoy: Date,
): ErroresVenta {
  const errors: ErroresVenta = {};
  if (!input.clienteId) errors.clienteId = "Selecciona un cliente";
  if (!input.concepto.trim()) errors.concepto = "Indica qué se vende";
  if (parseImporteEuros(input.importe) === null)
    errors.importe = "Indica un importe válido";
  if (!input.fecha) errors.fecha = "Indica una fecha";
  else if (startOfDay(input.fecha) > hoy)
    errors.fecha = "La fecha no puede ser futura";
  return errors;
}

export interface ErroresLogin {
  email?: string;
  password?: string;
}

/**
 * Validación pura de login (RAU-87), compartida por el formulario (errores
 * en vivo tras el primer intento de envío, mismo patrón que las anteriores).
 * Solo formato: no comprueba credenciales contra el backend, eso lo hace
 * `login()` (Convex Auth). Textos exactos del diseño ("Introduce un email
 * válido" / "Introduce tu contraseña"). Devuelve `{}` si no hay errores.
 */
export function validarLogin(email: string, password: string): ErroresLogin {
  const errors: ErroresLogin = {};
  if (!validEmail(email.trim())) errors.email = "Introduce un email válido";
  if (!password.trim()) errors.password = "Introduce tu contraseña";
  return errors;
}

export interface ErroresCambiarPasswordInicial {
  nuevaPassword?: string;
  repetir?: string;
}

/** Mismo mínimo que exige el backend (convex/usuarios.ts, MIN_PASSWORD). */
const MIN_PASSWORD_INICIAL = 6;

/**
 * Validación pura del cambio de contraseña inicial (RAU-87 adenda),
 * compartida por el formulario (errores en vivo tras el primer intento,
 * mismo patrón que `validarLogin`). Textos exactos del diseño ("Mínimo 6
 * caracteres" / "Las contraseñas no coinciden"). Devuelve `{}` si no hay
 * errores.
 */
export function validarCambiarPasswordInicial(
  nuevaPassword: string,
  repetir: string,
): ErroresCambiarPasswordInicial {
  const errors: ErroresCambiarPasswordInicial = {};
  if (nuevaPassword.length < MIN_PASSWORD_INICIAL) {
    errors.nuevaPassword = "Mínimo 6 caracteres";
  } else if (nuevaPassword !== repetir) {
    errors.repetir = "Las contraseñas no coinciden";
  }
  return errors;
}

/** Resuelve la semilla de clientes a `Cliente[]` con la fecha real de último contacto. */
function resolverClientes(hoy: Date): Cliente[] {
  return CLIENTES_SEMILLA.map((c) => ({
    id: c.id,
    nombre: c.nombre,
    empresa: c.empresa,
    estado: c.estado,
    telefono: c.telefono,
    email: c.email,
    fechaUltimoContacto: addDays(hoy, -c.ultimoContactoOffset),
  }));
}

interface EstadoApp {
  today: Date | null;
  clientes: Cliente[];
  seguimientos: Seguimiento[];
  interacciones: Interaccion[];
  ventas: Venta[];
}

/**
 * Datos y mutaciones del CRM que siguen siendo 100% mock en memoria (RAU-87
 * solo hace real la parte de usuarios/sesión; clientes/seguimientos/
 * interacciones/ventas quedan sin tocar hasta una tarea futura que los
 * conecte a Convex). `currentUser` se recibe como parámetro en vez de
 * resolverse aquí dentro: lo calcula quien llame a este hook (con sesión
 * real traducida al espacio de ids de `USUARIOS`, o `null` sin backend) -
 * ver `AppDataProviderConAuth`/`AppDataProviderSinBackend` más abajo.
 */
function useMockCrmData(currentUser: Usuario | null) {
  const [state, setState] = useState<EstadoApp>({
    today: null,
    clientes: [],
    seguimientos: [],
    interacciones: [],
    ventas: [],
  });
  const { today, clientes, seguimientos, interacciones, ventas } = state;

  // Al montar (solo cliente): resolver fechas de la semilla. Se hace tras
  // montar para evitar el mismatch SSR/hidratación.
  useEffect(() => {
    const hoy = startOfDay(new Date());
    const resueltos: Seguimiento[] = SEGUIMIENTOS_SEMILLA.map((s) => ({
      id: s.id,
      clienteId: s.clienteId,
      accion: s.accion,
      vence: addDays(hoy, s.venceOffset),
      hecho: s.hecho ?? false,
      fechaHecho: s.hecho ? hoy : undefined,
      responsableId: s.responsableId,
    }));
    const interaccionesResueltas: Interaccion[] = INTERACCIONES_SEMILLA.map((i) => ({
      id: i.id,
      clienteId: i.clienteId,
      canal: i.canal,
      texto: i.texto,
      fecha: addDays(hoy, -i.fechaOffset),
      autorId: i.autorId,
    }));
    const ventasResueltas: Venta[] = VENTAS_SEMILLA.map((v) => ({
      id: v.id,
      clienteId: v.clienteId,
      concepto: v.concepto,
      importe: v.importe,
      estado: v.estado,
      fecha: addDays(hoy, -v.fechaOffset),
      autorId: v.autorId,
    }));
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState((s) => ({
      ...s,
      today: hoy,
      // Merge por id: preserva altas hechas antes de resolver la semilla y no
      // duplica clientes si el efecto se reejecutara.
      clientes: [
        ...s.clientes,
        ...resolverClientes(hoy).filter(
          (c) => !s.clientes.some((x) => x.id === c.id),
        ),
      ],
      seguimientos: resueltos,
      interacciones: interaccionesResueltas,
      ventas: ventasResueltas,
    }));
  }, []);

  const loading = today === null;

  const clientePorId = useMemo(
    () => new Map(clientes.map((c) => [c.id, c])),
    [clientes],
  );
  const usuarioPorId = useMemo(
    () => new Map(USUARIOS.map((u) => [u.id, u])),
    [],
  );

  const { atrasados, paraHoy } = useMemo(() => {
    const vacio = {
      atrasados: [] as SeguimientoEnriquecido[],
      paraHoy: [] as SeguimientoEnriquecido[],
    };
    if (!today) return vacio;

    const enriquecer = (s: Seguimiento): SeguimientoEnriquecido => ({
      ...s,
      cliente: clientePorId.get(s.clienteId)!,
      responsable: usuarioPorId.get(s.responsableId)!,
    });

    const pendientes = seguimientos.filter((s) => !s.hecho);
    const atr = pendientes
      .filter((s) => bucket(s.vence, today) === "atrasado")
      .sort((a, b) => a.vence.getTime() - b.vence.getTime())
      .map(enriquecer);
    const hoy = pendientes
      .filter((s) => bucket(s.vence, today) === "hoy")
      .map(enriquecer);
    return { atrasados: atr, paraHoy: hoy };
  }, [seguimientos, today, clientePorId, usuarioPorId]);

  const pendientesCount = atrasados.length + paraHoy.length;

  function seguimientosDeCliente(clienteId: string) {
    const cliente = clientePorId.get(clienteId);
    // Enriquecer con lookup seguro: descarta seguimientos cuyo cliente o
    // responsable no exista (robusto de cara al backend real).
    const enriquecer = (s: Seguimiento): SeguimientoEnriquecido | null => {
      const responsable = usuarioPorId.get(s.responsableId);
      if (!cliente || !responsable) return null;
      return { ...s, cliente, responsable };
    };
    const noNulo = (
      s: SeguimientoEnriquecido | null,
    ): s is SeguimientoEnriquecido => s !== null;

    const delCliente = seguimientos.filter((s) => s.clienteId === clienteId);
    const pendientes = delCliente
      .filter((s) => !s.hecho)
      .sort((a, b) => a.vence.getTime() - b.vence.getTime()) // asc por vencimiento
      .map(enriquecer)
      .filter(noNulo);
    const completados = delCliente
      .filter((s) => s.hecho)
      .sort(
        (a, b) =>
          (b.fechaHecho ?? b.vence).getTime() -
          (a.fechaHecho ?? a.vence).getTime(),
      ) // desc por fecha de completado
      .map(enriquecer)
      .filter(noNulo);
    return { pendientes, completados };
  }

  function marcarHecho(id: string) {
    setState((s) => ({
      ...s,
      seguimientos: s.seguimientos.map((x) =>
        x.id === id
          ? { ...x, hecho: true, fechaHecho: s.today ?? startOfDay(new Date()) }
          : x,
      ),
    }));
  }

  function deshacer(id: string) {
    setState((s) => ({
      ...s,
      seguimientos: s.seguimientos.map((x) =>
        x.id === id ? { ...x, hecho: false, fechaHecho: undefined } : x,
      ),
    }));
  }

  function crearSeguimiento(
    input: CrearSeguimientoInput,
  ): CrearSeguimientoResultado {
    const errors = validarSeguimiento(input);
    // Existencia del cliente: el validador puro no conoce el mapa de clientes. El
    // guard `!errors.clienteId` conserva la precedencia (cliente vacío muestra
    // "Elige un cliente", no "Ese cliente no existe"), como en `registrarInteraccion`.
    if (!errors.clienteId && !clientePorId.has(input.clienteId))
      errors.clienteId = "Ese cliente no existe";
    if (Object.keys(errors).length > 0) return { ok: false, errors };

    // Responsable con fallback defensivo: un id inválido o ausente cae al usuario de
    // sesión (no da error) — "por defecto quien lo crea".
    const responsableId =
      input.responsableId && usuarioPorId.has(input.responsableId)
        ? input.responsableId
        : currentUser?.id ?? USUARIOS[0].id;

    const nuevo: Seguimiento = {
      id: nuevoId(),
      clienteId: input.clienteId,
      accion: input.accion.trim(),
      vence: startOfDay(input.vence!),
      hecho: false,
      fechaHecho: undefined,
      responsableId,
    };
    setState((s) => ({ ...s, seguimientos: [...s.seguimientos, nuevo] }));
    return { ok: true };
  }

  function crearCliente(input: CrearClienteInput): CrearClienteResultado {
    const errors = validarCliente(input);
    if (Object.keys(errors).length > 0) return { ok: false, errors };

    const nombre = input.nombre.trim();
    const email = input.email.trim();
    const telefono = input.telefono.trim();
    const hoy = today ?? startOfDay(new Date());
    const empresa = input.empresa.trim();
    const nota = input.nota.trim();
    // El objeto que se devuelve es el MISMO que se inserta en el estado (id y
    // fechas se calculan una sola vez), para evitar divergencias sutiles.
    const nuevo: Cliente = {
      id: nuevoClienteId(),
      nombre,
      empresa: empresa || undefined,
      estado: "nuevo",
      telefono: telefono || undefined,
      email: email || undefined,
      canalOrigen: input.canalOrigen ?? undefined,
      nota: nota || undefined,
      fechaRegistro: hoy,
      fechaUltimoContacto: hoy,
    };
    setState((s) => ({ ...s, clientes: [nuevo, ...s.clientes] }));
    return { ok: true, cliente: nuevo };
  }

  function interaccionesDeCliente(clienteId: string): InteraccionEnriquecida[] {
    // Lookup seguro del autor (descarta interacciones huérfanas), como
    // `seguimientosDeCliente`. Orden desc por fecha (más reciente primero).
    const enriquecer = (i: Interaccion): InteraccionEnriquecida | null => {
      const autor = usuarioPorId.get(i.autorId);
      return autor ? { ...i, autor } : null;
    };
    const noNulo = (
      i: InteraccionEnriquecida | null,
    ): i is InteraccionEnriquecida => i !== null;
    return interacciones
      .filter((i) => i.clienteId === clienteId)
      .sort((a, b) => b.fecha.getTime() - a.fecha.getTime())
      .map(enriquecer)
      .filter(noNulo);
  }

  function registrarInteraccion(
    input: RegistrarInteraccionInput,
  ): RegistrarInteraccionResultado {
    const hoy = today ?? startOfDay(new Date());
    const errors = validarInteraccion(input, hoy);
    // Existencia del cliente: el validador puro no conoce el mapa de clientes.
    if (!errors.clienteId && !clientePorId.has(input.clienteId))
      errors.clienteId = "Ese cliente no existe";
    if (Object.keys(errors).length > 0) return { ok: false, errors };

    const fecha = startOfDay(input.fecha!);
    const nueva: Interaccion = {
      id: nuevoInteraccionId(),
      clienteId: input.clienteId,
      canal: input.canal,
      texto: input.texto.trim(),
      fecha,
      autorId: currentUser?.id ?? USUARIOS[0].id,
    };
    // setState atómico: añade la interacción y, en la misma actualización, avanza
    // `fechaUltimoContacto` si no había fecha previa o la nueva es igual/posterior.
    setState((s) => ({
      ...s,
      interacciones: [nueva, ...s.interacciones],
      clientes: s.clientes.map((c) =>
        c.id === input.clienteId &&
        (!c.fechaUltimoContacto || fecha >= c.fechaUltimoContacto)
          ? { ...c, fechaUltimoContacto: fecha }
          : c,
      ),
    }));
    return { ok: true };
  }

  function ventasDeCliente(clienteId: string): VentaEnriquecida[] {
    // Lookup seguro del autor (descarta ventas huérfanas), como `interaccionesDeCliente`.
    // Orden desc por fecha (más reciente primero).
    const enriquecer = (v: Venta): VentaEnriquecida | null => {
      const autor = usuarioPorId.get(v.autorId);
      return autor ? { ...v, autor } : null;
    };
    const noNulo = (v: VentaEnriquecida | null): v is VentaEnriquecida =>
      v !== null;
    return ventas
      .filter((v) => v.clienteId === clienteId)
      .sort((a, b) => b.fecha.getTime() - a.fecha.getTime())
      .map(enriquecer)
      .filter(noNulo);
  }

  function registrarVenta(
    input: RegistrarVentaInput,
  ): RegistrarVentaResultado {
    const hoy = today ?? startOfDay(new Date());
    const errors = validarVenta(input, hoy);
    // Existencia del cliente: el validador puro no conoce el mapa de clientes.
    if (!errors.clienteId && !clientePorId.has(input.clienteId))
      errors.clienteId = "Ese cliente no existe";
    if (Object.keys(errors).length > 0) return { ok: false, errors };

    const fecha = startOfDay(input.fecha!);
    const nueva: Venta = {
      id: nuevoVentaId(),
      clienteId: input.clienteId,
      concepto: input.concepto.trim(),
      // No-null asegurado por el validador (mismo criterio que `input.fecha!`).
      importe: parseImporteEuros(input.importe)!,
      estado: ESTADOS_VENTA_VALIDOS.includes(input.estado)
        ? input.estado
        : "abierta",
      fecha,
      autorId: currentUser?.id ?? USUARIOS[0].id,
    };
    // setState atómico (mismo patrón que `registrarInteraccion`): añade la venta y avanza
    // `fechaUltimoContacto` si no había fecha previa o la nueva es igual/posterior. Como la
    // fecha no puede ser futura (validada arriba), nunca introduce una fecha futura.
    setState((s) => ({
      ...s,
      ventas: [nueva, ...s.ventas],
      clientes: s.clientes.map((c) =>
        c.id === input.clienteId &&
        (!c.fechaUltimoContacto || fecha >= c.fechaUltimoContacto)
          ? { ...c, fechaUltimoContacto: fecha }
          : c,
      ),
    }));
    return { ok: true };
  }

  return {
    loading,
    today,
    clientes,
    usuarios: USUARIOS,
    atrasados,
    paraHoy,
    pendientesCount,
    seguimientosDeCliente,
    marcarHecho,
    deshacer,
    crearSeguimiento,
    crearCliente,
    interacciones,
    interaccionesDeCliente,
    registrarInteraccion,
    ventas,
    ventasDeCliente,
    registrarVenta,
  };
}

/**
 * Variante sin backend: replica el comportamiento de antes de que
 * `NEXT_PUBLIC_CONVEX_URL` estuviera configurada (arranque sin romper,
 * `authLoaded` inmediato, sin sesión posible). Cero hooks de Convex Auth -
 * necesario porque `ConvexClientProvider` no monta ningún provider de
 * Convex en este caso (ver convex-client-provider.tsx), y los hooks de
 * Convex Auth no se pueden llamar sin uno.
 */
function AppDataProviderSinBackend({ children }: { children: ReactNode }) {
  const mock = useMockCrmData(null);
  const value: AppData = {
    ...mock,
    authLoaded: true,
    currentUser: null,
    debeCambiarPassword: false,
    login: async () => ({
      ok: false,
      error: "Backend no configurado (falta NEXT_PUBLIC_CONVEX_URL).",
    }),
    loginConGoogle: async () => ({
      ok: false,
      error: "Backend no configurado (falta NEXT_PUBLIC_CONVEX_URL).",
    }),
    completarLoginGoogle: async () => ({
      ok: false,
      error: "Backend no configurado (falta NEXT_PUBLIC_CONVEX_URL).",
    }),
    logout: async () => {},
    cambiarPasswordInicial: async () => ({
      ok: false,
      error: "Backend no configurado (falta NEXT_PUBLIC_CONVEX_URL).",
    }),
  };
  return (
    <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>
  );
}

/**
 * Variante real (RAU-87): único sitio del provider que llama a
 * useConvexAuth/useAuthActions/useQuery. `currentUser` se traduce al
 * espacio de ids de `USUARIOS` (mock) por email - el subsistema de
 * seguimientos/interacciones/ventas sigue siendo 100% mock y no entiende
 * los `_id` reales de Convex; ver plan RAU-87 para el razonamiento
 * completo. Invariante que esto exige: el email de cada fila `usuarios` en
 * Convex (el del bootstrap, scripts/bootstrap-admin.mjs, o el migrado por
 * RAU-213 para la propietaria) debe coincidir exactamente con el de la
 * fila correspondiente en `USUARIOS` (mock, src/lib/mock/data.ts).
 */
function AppDataProviderConAuth({ children }: { children: ReactNode }) {
  const { isLoading: authLoading, isAuthenticated } = useConvexAuth();
  const { signIn, signOut } = useAuthActions();
  const authUserRaw = useQuery(
    api.usuarios.obtenerActual,
    isAuthenticated ? {} : "skip",
  );

  const currentUser: Usuario | null = authUserRaw
    ? {
        id:
          USUARIOS.find((u) => u.email === authUserRaw.email)?.id ??
          authUserRaw._id,
        nombre: authUserRaw.nombre,
        email: authUserRaw.email,
        rol: authUserRaw.rol,
      }
    : null;
  const debeCambiarPassword = authUserRaw?.debeCambiarPassword ?? false;
  const authLoaded = !authLoading && (!isAuthenticated || authUserRaw !== undefined);

  const mock = useMockCrmData(currentUser);
  const cambiarPasswordInicialAction = useAction(api.usuarios.cambiarPasswordInicial);

  async function login(email: string, password: string): Promise<LoginResultado> {
    try {
      await signIn("password", { email, password, flow: "signIn" });
      return { ok: true };
    } catch {
      // Mensaje fijo: no filtra si el email existe o la contraseña es la
      // incorrecta (mismo texto que el diseño exige).
      return { ok: false, error: "Email o contraseña incorrectos" };
    }
  }

  async function loginConGoogle(): Promise<LoginResultado> {
    try {
      // redirectTo es obligatorio, no cosmético (RAU-213): sin él, el
      // callback de @convex-dev/auth manda tanto el éxito como el rechazo a
      // SITE_URL a secas (no a /login), y GoogleRedirectHandler nunca vería
      // ni el `code` ni la señal de rechazo. El marcador `oauthIntento`
      // sobrevive tal cual al viaje de ida y vuelta (ver login/page.tsx).
      await signIn("google", { redirectTo: "/login?oauthIntento=google" });
      return { ok: true };
    } catch {
      return { ok: false, error: "No se pudo iniciar el acceso con Google." };
    }
  }

  async function completarLoginGoogle(code: string): Promise<LoginResultado> {
    const rechazo: LoginResultado = {
      ok: false,
      error:
        "No se pudo completar el acceso con Google. Si tu cuenta no está autorizada, pide que te den de alta.",
    };
    try {
      // El tipo público de `signIn` (useAuthActions) exige `provider:
      // string`, pero en runtime acepta `undefined` para completar un
      // código OAuth ya iniciado - es EXACTAMENTE lo que hace el manejo
      // automático interno de la librería
      // (@convex-dev/auth/dist/react/client.js: `await signIn(undefined, {
      // code })`, mismo closure que expone este hook). Necesitamos llamarlo
      // así porque `shouldHandleCode={false}` (convex-client-provider.tsx)
      // desactiva ese manejo automático a propósito, para poder mostrar el
      // rechazo de vincularUsuarioGoogle en vez de tragárselo en silencio.
      //
      // Un código inválido/caducado/ya consumido NO lanza: verifyCodeOnly
      // (@convex-dev/auth/src/server/implementation/mutations/
      // verifyCodeAndSignIn.ts) devuelve `null` en ese caso, que el cliente
      // traduce en `{ signingIn: false }` sin excepción (hallazgo de
      // Auditoría sobre este mismo commit) - hay que comprobar `signingIn`
      // explícitamente, no asumir éxito por la sola ausencia de throw.
      const resultado = (await (
        signIn as unknown as (
          provider: string | undefined,
          params?: Record<string, unknown>,
        ) => Promise<{ signingIn: boolean }>
      )(undefined, { code })) as { signingIn: boolean };
      return resultado.signingIn ? { ok: true } : rechazo;
    } catch {
      return rechazo;
    }
  }

  async function logout(): Promise<void> {
    // `signOut()` debe esperarse de verdad: si quien llama navega a /login
    // antes de que termine, /login puede ver authLoaded && currentUser
    // todavía activos y rebotar de vuelta a /hoy (condición de carrera).
    await signOut();
  }

  async function cambiarPasswordInicial(
    nuevaPassword: string,
  ): Promise<CambiarPasswordInicialResultado> {
    try {
      await cambiarPasswordInicialAction({ nuevaPassword });
      return { ok: true };
    } catch (err) {
      // ConvexError con `data` string (p. ej. "temporal caducada") se
      // muestra tal cual; cualquier otra forma (incluida la validación de
      // longitud, que el formulario ya evita mandar) cae a un mensaje
      // genérico - no se filtra el detalle interno.
      const mensaje =
        err instanceof ConvexError && typeof err.data === "string"
          ? err.data
          : "No se pudo cambiar la contraseña. Inténtalo de nuevo.";
      return { ok: false, error: mensaje };
    }
  }

  const value: AppData = {
    ...mock,
    authLoaded,
    currentUser,
    debeCambiarPassword,
    login,
    loginConGoogle,
    completarLoginGoogle,
    logout,
    cambiarPasswordInicial,
  };
  return (
    <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>
  );
}

export function AppDataProvider({ children }: { children: ReactNode }) {
  const tieneBackend = !!process.env.NEXT_PUBLIC_CONVEX_URL;
  return tieneBackend ? (
    <AppDataProviderConAuth>{children}</AppDataProviderConAuth>
  ) : (
    <AppDataProviderSinBackend>{children}</AppDataProviderSinBackend>
  );
}
