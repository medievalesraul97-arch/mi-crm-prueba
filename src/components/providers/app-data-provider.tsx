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
  Cliente,
  Seguimiento,
  SeguimientoEnriquecido,
  Usuario,
} from "@/lib/types";
import { CLIENTES, SEGUIMIENTOS_SEMILLA, USUARIOS } from "@/lib/mock/data";
import { addDays, bucket, startOfDay } from "@/lib/date";

export interface CrearSeguimientoInput {
  clienteId: string;
  accion: string;
  vence: Date | null;
}

export interface ErroresSeguimiento {
  clienteId?: string;
  accion?: string;
  vence?: string;
}

export type CrearSeguimientoResultado =
  | { ok: true }
  | { ok: false; errors: ErroresSeguimiento };

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
  marcarHecho: (id: string) => void;
  deshacer: (id: string) => void;
  crearSeguimiento: (input: CrearSeguimientoInput) => CrearSeguimientoResultado;
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

let seq = 0;
function nuevoId(): string {
  seq += 1;
  return `s-nuevo-${Date.now()}-${seq}`;
}

interface EstadoApp {
  today: Date | null;
  seguimientos: Seguimiento[];
  sessionUserId: string | null;
  authLoaded: boolean;
}

export function AppDataProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<EstadoApp>({
    today: null,
    seguimientos: [],
    sessionUserId: null,
    authLoaded: false,
  });
  const { today, seguimientos, sessionUserId, authLoaded } = state;

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
    let stored: string | null = null;
    try {
      stored = localStorage.getItem(SESSION_KEY);
    } catch {
      stored = null;
    }
    if (stored && !USUARIOS.some((u) => u.id === stored)) stored = null;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState({
      today: hoy,
      seguimientos: resueltos,
      sessionUserId: stored,
      authLoaded: true,
    });
  }, []);

  const loading = today === null;

  const clientePorId = useMemo(
    () => new Map(CLIENTES.map((c) => [c.id, c])),
    [],
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
    const errors: ErroresSeguimiento = {};
    if (!input.clienteId) errors.clienteId = "Elige un cliente";
    else if (!clientePorId.has(input.clienteId))
      errors.clienteId = "Ese cliente no existe";
    if (!input.accion.trim()) errors.accion = "Escribe qué hay que hacer";
    if (!input.vence) errors.vence = "Indica una fecha";
    if (Object.keys(errors).length > 0) return { ok: false, errors };

    const nuevo: Seguimiento = {
      id: nuevoId(),
      clienteId: input.clienteId,
      accion: input.accion.trim(),
      vence: startOfDay(input.vence!),
      hecho: false,
      fechaHecho: undefined,
      responsableId: currentUser?.id ?? USUARIOS[0].id,
    };
    setState((s) => ({ ...s, seguimientos: [...s.seguimientos, nuevo] }));
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
    clientes: CLIENTES,
    usuarios: USUARIOS,
    currentUser,
    atrasados,
    paraHoy,
    pendientesCount,
    marcarHecho,
    deshacer,
    crearSeguimiento,
    login,
    logout,
    setCurrentUser,
  };

  return (
    <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>
  );
}
