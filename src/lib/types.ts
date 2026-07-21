export type Rol = "propietaria" | "comercial";

export interface Usuario {
  id: string;
  nombre: string;
  email: string;
  rol: Rol;
}

export type EstadoCliente = "nuevo" | "negociacion" | "ganado" | "perdido";

export interface Cliente {
  id: string;
  nombre: string;
  empresa?: string;
  estado: EstadoCliente;
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
