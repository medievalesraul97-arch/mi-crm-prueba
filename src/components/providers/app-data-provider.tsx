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
import {
  CLIENTES,
  SEGUIMIENTOS_SEMILLA,
  USUARIOS,
  USUARIO_ACTUAL_ID,
} from "@/lib/mock/data";
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

interface AppData {
  /** `true` hasta que el cliente resuelve `today` + fechas (evita mismatch SSR). */
  loading: boolean;
  today: Date | null;
  clientes: Cliente[];
  usuarios: Usuario[];
  currentUser: Usuario;
  atrasados: SeguimientoEnriquecido[];
  paraHoy: SeguimientoEnriquecido[];
  pendientesCount: number;
  marcarHecho: (id: string) => void;
  deshacer: (id: string) => void;
  crearSeguimiento: (input: CrearSeguimientoInput) => CrearSeguimientoResultado;
  setCurrentUser: (id: string) => void;
}

const AppDataContext = createContext<AppData | null>(null);

export function useAppData(): AppData {
  const ctx = useContext(AppDataContext);
  if (!ctx) throw new Error("useAppData debe usarse dentro de <AppDataProvider>");
  return ctx;
}

let seq = 0;
function nuevoId(): string {
  seq += 1;
  return `s-nuevo-${Date.now()}-${seq}`;
}

interface EstadoMock {
  today: Date | null;
  seguimientos: Seguimiento[];
}

export function AppDataProvider({ children }: { children: ReactNode }) {
  const [{ today, seguimientos }, setEstado] = useState<EstadoMock>({
    today: null,
    seguimientos: [],
  });
  const [currentUserId, setCurrentUserId] = useState<string>(USUARIO_ACTUAL_ID);

  // Resolver `today` + fechas SOLO en cliente tras montar. El estado inicial es
  // "loading" (today === null) y las pantallas lo leen explícitamente en vez de
  // inferir la carga por listas vacías. Este setState en el efecto es
  // intencionado: derivar de la hora local del cliente en el mount es lo que
  // evita el mismatch SSR/hidratación (no hay alternativa sin efecto).
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
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEstado({ today: hoy, seguimientos: resueltos });
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
  const currentUser = usuarioPorId.get(currentUserId) ?? USUARIOS[0];

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
    setEstado((prev) => ({
      ...prev,
      seguimientos: prev.seguimientos.map((s) =>
        s.id === id
          ? { ...s, hecho: true, fechaHecho: prev.today ?? startOfDay(new Date()) }
          : s,
      ),
    }));
  }

  function deshacer(id: string) {
    setEstado((prev) => ({
      ...prev,
      seguimientos: prev.seguimientos.map((s) =>
        s.id === id ? { ...s, hecho: false, fechaHecho: undefined } : s,
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
      responsableId: currentUser.id,
    };
    setEstado((prev) => ({ ...prev, seguimientos: [...prev.seguimientos, nuevo] }));
    return { ok: true };
  }

  const value: AppData = {
    loading,
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
    setCurrentUser: setCurrentUserId,
  };

  return (
    <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>
  );
}
