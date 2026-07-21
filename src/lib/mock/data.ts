import type { Cliente, Usuario } from "@/lib/types";

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

export const CLIENTES: Cliente[] = [
  { id: "c-1", nombre: "Laura Sánchez", empresa: "Estudio Nórdico", estado: "negociacion" },
  { id: "c-2", nombre: "Diego Fernández", empresa: "Cafés del Sur", estado: "nuevo" },
  { id: "c-3", nombre: "Ana Torres", empresa: "Torres & Co", estado: "ganado" },
  { id: "c-4", nombre: "Javier Molina", estado: "negociacion" },
  { id: "c-5", nombre: "Marina López", empresa: "Diseño Aurora", estado: "nuevo" },
  { id: "c-6", nombre: "Pablo Herrero", empresa: "Herrero Legal", estado: "perdido" },
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
