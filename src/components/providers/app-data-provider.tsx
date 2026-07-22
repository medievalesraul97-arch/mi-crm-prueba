"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type {
  CanalInteraccion,
  CanalOrigen,
  Cliente,
  Interaccion,
  InteraccionEnriquecida,
  Seguimiento,
  SeguimientoEnriquecido,
  Usuario,
} from "@/lib/types";
import {
  CLIENTES_SEMILLA,
  INTERACCIONES_SEMILLA,
  SEGUIMIENTOS_SEMILLA,
  USUARIOS,
} from "@/lib/mock/data";
import { addDays, bucket, startOfDay } from "@/lib/date";

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

export type LoginResultado = { ok: true } | { ok: false; error: string };

interface AppData {
  /** `true` hasta que el cliente resuelve `today` + fechas (evita mismatch SSR). */
  loading: boolean;
  /** `true` cuando ya se leyó la sesión de localStorage (para el gate de auth). */
  authLoaded: boolean;
  today: Date | null;
  clientes: Cliente[];
  usuarios: Usuario[];
  /** Usuario con sesión iniciada, o `null` si no hay sesión (login mock). */
  currentUser: Usuario | null;
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
  /** Login mock: valida por email (cualquier contraseña no vacía). */
  login: (email: string, password: string) => LoginResultado;
  logout: () => void;
  setCurrentUser: (id: string) => void;
}

const AppDataContext = createContext<AppData | null>(null);

export function useAppData(): AppData {
  const ctx = useContext(AppDataContext);
  if (!ctx) throw new Error("useAppData debe usarse dentro de <AppDataProvider>");
  return ctx;
}

const SESSION_KEY = "vibecrm_session";

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

/** Canales de interacción válidos, para validar defensivamente en el provider. */
const CANALES_INTERACCION: readonly CanalInteraccion[] = [
  "llamada",
  "email",
  "whatsapp",
  "en_persona",
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
  sessionUserId: string | null;
  authLoaded: boolean;
}

export function AppDataProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<EstadoApp>({
    today: null,
    clientes: [],
    seguimientos: [],
    interacciones: [],
    sessionUserId: null,
    authLoaded: false,
  });
  const { today, clientes, seguimientos, interacciones, sessionUserId, authLoaded } =
    state;

  // Al montar (solo cliente): resolver fechas + leer la sesión de localStorage.
  // Se hace tras montar para evitar el mismatch SSR/hidratación.
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
    let stored: string | null = null;
    try {
      stored = localStorage.getItem(SESSION_KEY);
    } catch {
      stored = null;
    }
    if (stored && !USUARIOS.some((u) => u.id === stored)) stored = null;
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
      sessionUserId: stored,
      authLoaded: true,
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
  const currentUser = sessionUserId
    ? usuarioPorId.get(sessionUserId) ?? null
    : null;

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

  function persistSession(id: string | null) {
    try {
      if (id) localStorage.setItem(SESSION_KEY, id);
      else localStorage.removeItem(SESSION_KEY);
    } catch {
      // localStorage no disponible: la sesión no persiste, pero no rompe.
    }
  }

  function login(email: string, password: string): LoginResultado {
    const user = USUARIOS.find(
      (u) => u.email.toLowerCase() === email.trim().toLowerCase(),
    );
    if (!user || !password.trim()) {
      return { ok: false, error: "Email o contraseña incorrectos" };
    }
    setState((s) => ({ ...s, sessionUserId: user.id }));
    persistSession(user.id);
    return { ok: true };
  }

  function logout() {
    setState((s) => ({ ...s, sessionUserId: null }));
    persistSession(null);
  }

  function setCurrentUser(id: string) {
    setState((s) => ({ ...s, sessionUserId: id }));
    persistSession(id);
  }

  const value: AppData = {
    loading,
    authLoaded,
    today,
    clientes,
    usuarios: USUARIOS,
    currentUser,
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
    login,
    logout,
    setCurrentUser,
  };

  return (
    <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>
  );
}
