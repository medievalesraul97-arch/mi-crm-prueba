export type Rol = "propietaria" | "comercial";

export interface Usuario {
  id: string;
  nombre: string;
  email: string;
  rol: Rol;
}

export type EstadoCliente = "nuevo" | "negociacion" | "ganado" | "perdido";

export type CanalOrigen = "web" | "redes" | "email" | "whatsapp";

export interface Cliente {
  id: string;
  nombre: string;
  empresa?: string;
  estado: EstadoCliente;
  telefono?: string;
  email?: string;
  canalOrigen?: CanalOrigen;
  nota?: string;
  fechaRegistro?: Date;
  fechaUltimoContacto?: Date;
}

export interface Seguimiento {
  id: string;
  clienteId: string;
  accion: string;
  vence: Date;
  hecho: boolean;
  fechaHecho?: Date;
  responsableId: string;
}

/** Seguimiento con cliente y responsable ya resueltos, para pintar la UI. */
export interface SeguimientoEnriquecido extends Seguimiento {
  cliente: Cliente;
  responsable: Usuario;
}

/**
 * Canal por el que se registró una interacción (RAU-116). Conjunto DISTINTO de
 * `CanalOrigen`: aquí es cómo se contactó ("en persona" incluido), no de dónde
 * vino el cliente.
 */
export type CanalInteraccion = "llamada" | "email" | "whatsapp" | "en_persona";

export interface Interaccion {
  id: string;
  clienteId: string;
  canal: CanalInteraccion;
  texto: string;
  fecha: Date;
  autorId: string;
}

/** Interacción con el autor ya resuelto, para pintar el historial. */
export interface InteraccionEnriquecida extends Interaccion {
  autor: Usuario;
}

/** Estado de una venta/oportunidad (RAU-69). */
export type EstadoVenta = "abierta" | "ganada" | "perdida";

export interface Venta {
  id: string;
  clienteId: string;
  concepto: string;
  /** Euros enteros (el diseño no maneja céntimos). */
  importe: number;
  estado: EstadoVenta;
  fecha: Date;
  autorId: string;
}

/** Venta con el autor ya resuelto, para pintar el historial. */
export interface VentaEnriquecida extends Venta {
  autor: Usuario;
}
