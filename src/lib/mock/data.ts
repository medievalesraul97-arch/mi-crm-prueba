import type { EstadoCliente, Usuario } from "@/lib/types";

/**
 * Datos de ejemplo (mock en memoria) para el primer desarrollo UI-first.
 * `venceOffset` es un desfase en días respecto a HOY; el provider cliente lo
 * resuelve a una fecha real tras montar (ver app-data-provider). Así no se
 * calculan fechas a nivel de módulo y se evita el mismatch SSR/hidratación.
 */
export interface SeguimientoSemilla {
  id: string;
  clienteId: string;
  accion: string;
  venceOffset: number;
  hecho?: boolean;
  responsableId: string;
}

export const USUARIOS: Usuario[] = [
  { id: "u-marta", nombre: "Marta Ruiz", email: "marta@vibecrm.es", rol: "propietaria" },
  { id: "u-carlos", nombre: "Carlos Gómez", email: "carlos@vibecrm.es", rol: "comercial" },
];

/** Usuario con sesión iniciada por defecto (mock; el login real es RAU-87). */
export const USUARIO_ACTUAL_ID = "u-marta";

/**
 * Semilla de clientes. `ultimoContactoOffset` es días atrás (≥0) respecto a HOY;
 * el provider lo resuelve a una fecha real tras montar (igual que los
 * seguimientos), para no calcular fechas a nivel de módulo (mismatch SSR).
 */
export interface ClienteSemilla {
  id: string;
  nombre: string;
  empresa?: string;
  estado: EstadoCliente;
  telefono: string;
  email: string;
  ultimoContactoOffset: number;
}

export const CLIENTES_SEMILLA: ClienteSemilla[] = [
  { id: "c-1", nombre: "Laura Sánchez", empresa: "Estudio Nórdico", estado: "negociacion", telefono: "+34 600 123 456", email: "laura@estudionordico.es", ultimoContactoOffset: 0 },
  { id: "c-2", nombre: "Diego Fernández", empresa: "Cafés del Sur", estado: "nuevo", telefono: "+34 611 222 333", email: "diego@cafesdelsur.com", ultimoContactoOffset: 1 },
  { id: "c-3", nombre: "Ana Torres", empresa: "Torres & Co", estado: "ganado", telefono: "+34 622 333 444", email: "ana@torresyco.es", ultimoContactoOffset: 3 },
  { id: "c-4", nombre: "Javier Molina", estado: "negociacion", telefono: "+34 633 444 555", email: "javier.molina@gmail.com", ultimoContactoOffset: 6 },
  { id: "c-5", nombre: "Marina López", empresa: "Diseño Aurora", estado: "nuevo", telefono: "+34 644 555 666", email: "marina@disenoaurora.es", ultimoContactoOffset: 10 },
  { id: "c-6", nombre: "Pablo Herrero", empresa: "Herrero Legal", estado: "perdido", telefono: "+34 655 666 777", email: "pablo@herrerolegal.es", ultimoContactoOffset: 25 },
];

export const SEGUIMIENTOS_SEMILLA: SeguimientoSemilla[] = [
  { id: "s-1", clienteId: "c-1", accion: "Llamar para cerrar la propuesta", venceOffset: -3, responsableId: "u-marta" },
  { id: "s-2", clienteId: "c-2", accion: "Enviar el catálogo por email", venceOffset: -1, responsableId: "u-carlos" },
  { id: "s-3", clienteId: "c-4", accion: "Confirmar la reunión de la semana", venceOffset: -1, responsableId: "u-marta" },
  { id: "s-4", clienteId: "c-3", accion: "Preparar la factura del pedido", venceOffset: 0, responsableId: "u-marta" },
  { id: "s-5", clienteId: "c-5", accion: "Responder dudas sobre el plan", venceOffset: 0, responsableId: "u-carlos" },
  { id: "s-6", clienteId: "c-6", accion: "Seguimiento tras la reunión", venceOffset: 3, responsableId: "u-carlos" },
  { id: "s-7", clienteId: "c-1", accion: "Agradecer la última compra", venceOffset: -5, hecho: true, responsableId: "u-marta" },
];
