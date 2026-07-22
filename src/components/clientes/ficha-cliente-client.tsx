"use client";

import Link from "next/link";
import {
  ArrowLeft,
  CalendarPlus,
  Check,
  Mail,
  MessageSquare,
  MessageSquarePlus,
  Pencil,
  Phone,
  TrendingUp,
  UserX,
  type LucideIcon,
} from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckRedondo } from "@/components/hoy/check-redondo";
import { ESTADO_CLIENTE_BADGE } from "@/components/ui/estado-badge";
import { useAppData } from "@/components/providers/app-data-provider";
import { useToast } from "@/components/providers/toast-provider";
import { bucket, fechaCorta, ultimoContactoTexto, vencimientoTexto } from "@/lib/date";
import { cn } from "@/lib/utils";
import type { CanalOrigen, SeguimientoEnriquecido } from "@/lib/types";

const CANAL_LABEL: Record<CanalOrigen, string> = {
  web: "Web",
  redes: "Redes",
  email: "Email",
  whatsapp: "WhatsApp",
};

/** Href `tel:` normalizado: conserva un "+" inicial y descarta lo no numérico. */
function telHref(telefono: string): string {
  const t = telefono.trim();
  const plus = t.startsWith("+") ? "+" : "";
  return `tel:${plus}${t.replace(/[^0-9]/g, "")}`;
}

/**
 * Item del historial. Unión discriminada por `tipo`: hoy solo se produce
 * "seguimiento" (completado); RAU-116 (interacción) y RAU-69 (venta) añadirán
 * sus variantes a esta unión sin reescribir el render.
 */
interface HistorialSeguimiento {
  tipo: "seguimiento";
  key: string;
  fecha: Date;
  titulo: string;
  responsable: string;
}
type HistorialItem = HistorialSeguimiento;

export function FichaClienteClient({ clienteId }: { clienteId: string }) {
  const { clientes, loading, today, seguimientosDeCliente, marcarHecho, deshacer } =
    useAppData();
  const { showToast } = useToast();

  // Guard: hasta que el provider resuelve `today` (y siembra los clientes) no se
  // puede usar ningún helper de fecha (today es Date | null).
  if (loading || !today) return <FichaSkeleton />;

  const cliente = clientes.find((c) => c.id === clienteId);
  if (!cliente) return <FichaNoEncontrada />;

  const estado = ESTADO_CLIENTE_BADGE[cliente.estado];
  const { pendientes, completados } = seguimientosDeCliente(cliente.id);

  const historial: HistorialItem[] = completados.map((s) => ({
    tipo: "seguimiento",
    key: `s-${s.id}`,
    fecha: s.fechaHecho ?? s.vence,
    titulo: s.accion,
    responsable: s.responsable.nombre,
  }));
  // Ya viene ordenado desc por el selector; interacciones/ventas se mezclarán y
  // reordenarán aquí por `fecha` cuando existan (RAU-116 / RAU-69).

  function marcar(id: string) {
    marcarHecho(id);
    showToast({
      message: "Seguimiento completado",
      actionLabel: "Deshacer",
      onAction: () => deshacer(id),
    });
  }

  const proximamente = (nombre: string, issue: string) =>
    showToast({ message: `${nombre} llega en ${issue}` });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <Link
          href="/clientes"
          className="inline-flex items-center gap-1.5 text-sm text-text-muted hover:text-text"
        >
          <ArrowLeft className="h-4 w-4" strokeWidth={1.5} />
          Clientes
        </Link>
        <button
          type="button"
          onClick={() => proximamente("Editar cliente", "RAU-115")}
          className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border-strong bg-surface px-3 text-[13px] font-medium text-text hover:bg-surface-2"
        >
          <Pencil className="h-4 w-4" strokeWidth={1.5} />
          Editar
        </button>
      </div>

      {/* Cabecera */}
      <Card className="flex flex-col gap-3.5">
        <div className="flex items-start gap-3.5">
          <Avatar name={cliente.nombre} className="h-14 w-14 text-base" />
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <h1 className="text-[19px] font-semibold leading-tight tracking-[-0.011em] text-text">
              {cliente.nombre}
            </h1>
            {cliente.empresa && (
              <p className="truncate text-sm text-text-muted">{cliente.empresa}</p>
            )}
          </div>
          <Badge tone={estado.tone} className="shrink-0">
            {estado.label}
          </Badge>
        </div>

        {cliente.canalOrigen && (
          <div>
            <Badge tone="neutral" dot={false}>
              Origen: {CANAL_LABEL[cliente.canalOrigen]}
            </Badge>
          </div>
        )}

        <div className="flex flex-col border-t border-border">
          <ContactRow
            icon={Phone}
            label="Teléfono"
            value={cliente.telefono}
            href={cliente.telefono ? telHref(cliente.telefono) : undefined}
          />
          <ContactRow
            icon={Mail}
            label="Email"
            value={cliente.email}
            href={cliente.email ? `mailto:${cliente.email.trim()}` : undefined}
            last
          />
        </div>
      </Card>

      {/* Accesos rápidos */}
      <div className="flex flex-col gap-2.5 md:flex-row">
        <QuickBtn
          icon={MessageSquarePlus}
          label="Registrar interacción"
          onClick={() => proximamente("Registrar interacción", "RAU-116")}
        />
        <QuickBtn
          icon={CalendarPlus}
          label="Programar seguimiento"
          onClick={() => proximamente("Programar seguimiento", "RAU-72")}
        />
        <QuickBtn
          icon={TrendingUp}
          label="Registrar venta"
          onClick={() => proximamente("Registrar venta", "RAU-69")}
        />
      </div>

      {/* Seguimientos pendientes */}
      <Card>
        <CardHeader title="Seguimientos pendientes" />
        {pendientes.length === 0 ? (
          <p className="text-sm text-text-muted">Sin seguimientos pendientes.</p>
        ) : (
          <div className="flex flex-col">
            {pendientes.map((s) => (
              <PendienteRow
                key={s.id}
                seguimiento={s}
                today={today}
                onMarcar={marcar}
              />
            ))}
          </div>
        )}
      </Card>

      {/* Historial */}
      <Card>
        <CardHeader title="Historial" />
        {historial.length === 0 ? (
          <EmptyState
            icon={MessageSquare}
            title="Sin actividad todavía"
            description="Anota una interacción o registra una venta para empezar el historial."
          />
        ) : (
          <div className="flex flex-col">
            {historial.map((h) => (
              <HistorialRow key={h.key} item={h} today={today} />
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function ContactRow({
  icon: Icon,
  label,
  value,
  href,
  last = false,
}: {
  icon: LucideIcon;
  label: string;
  value?: string;
  href?: string;
  last?: boolean;
}) {
  const inner = (
    <>
      <Icon className="h-[18px] w-[18px] shrink-0 text-text-subtle" strokeWidth={1.5} />
      <span className="w-[72px] shrink-0 text-[13px] text-text-subtle">{label}</span>
      <span className="min-w-0 flex-1 truncate text-sm text-text">
        {value ?? "—"}
      </span>
    </>
  );
  const base = cn(
    "flex items-center gap-3 py-3",
    !last && "border-b border-border",
  );
  return href ? (
    <a href={href} className={cn(base, "-mx-1 rounded-md px-1 hover:bg-surface-2")}>
      {inner}
    </a>
  ) : (
    <div className={base}>{inner}</div>
  );
}

function QuickBtn({
  icon: Icon,
  label,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex min-h-[52px] flex-1 items-center justify-start gap-3 rounded-xl border border-border bg-surface px-4 py-3.5 text-[15px] font-medium text-text shadow-xs hover:bg-surface-2",
        "md:flex-col md:justify-center md:gap-2 md:px-2.5 md:py-4 md:text-[13px]",
      )}
    >
      <Icon className="h-5 w-5 shrink-0 text-primary" strokeWidth={1.5} />
      <span>{label}</span>
    </button>
  );
}

function PendienteRow({
  seguimiento,
  today,
  onMarcar,
}: {
  seguimiento: SeguimientoEnriquecido;
  today: Date;
  onMarcar: (id: string) => void;
}) {
  const { id, accion, vence, responsable } = seguimiento;
  const atrasado = bucket(vence, today) === "atrasado";
  const sub = vencimientoTexto(vence, today);

  return (
    <div className="flex items-center gap-2 border-t border-border py-2.5 first:border-t-0">
      <CheckRedondo
        checked={false}
        onChange={() => onMarcar(id)}
        label={`Marcar como hecho: ${accion}`}
      />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-[15px] font-medium text-text">{accion}</span>
        <span
          className={cn(
            "text-[13px]",
            atrasado ? "text-error-text" : "text-text-muted",
          )}
        >
          {sub}
        </span>
      </div>
      <span
        title={responsable.nombre}
        className="hidden shrink-0 sm:inline-flex"
      >
        <Avatar
          name={responsable.nombre}
          variant="neutral"
          className="h-8 w-8 text-[11px]"
        />
      </span>
      <Badge tone={atrasado ? "error" : "warning"} className="shrink-0">
        {atrasado ? "Atrasado" : "Pendiente"}
      </Badge>
    </div>
  );
}

function HistorialRow({ item, today }: { item: HistorialItem; today: Date }) {
  // Discriminado por `item.tipo`; hoy solo "seguimiento" (interacción/venta:
  // RAU-116 / RAU-69).
  return (
    <div className="flex items-start gap-3 border-t border-border py-3 first:border-t-0">
      <span className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full bg-primary-subtle text-primary">
        <Check className="h-[18px] w-[18px]" strokeWidth={2} />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-[15px] font-medium text-text">{item.titulo}</span>
        <span className="text-[13px] text-text-muted">Seguimiento completado</span>
        <span className="text-xs text-text-subtle">
          Responsable: {item.responsable}
        </span>
      </div>
      <span className="shrink-0 whitespace-nowrap text-xs text-text-subtle">
        {ultimoContactoTexto(item.fecha, today)} · {fechaCorta(item.fecha)}
      </span>
    </div>
  );
}

function FichaSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-5 w-24" />
      <Skeleton className="h-44 rounded-xl" />
      <div className="flex flex-col gap-2.5 md:flex-row">
        <Skeleton className="h-[52px] flex-1 rounded-xl" />
        <Skeleton className="h-[52px] flex-1 rounded-xl" />
        <Skeleton className="h-[52px] flex-1 rounded-xl" />
      </div>
      <Skeleton className="h-28 rounded-xl" />
      <Skeleton className="h-44 rounded-xl" />
    </div>
  );
}

function FichaNoEncontrada() {
  return (
    <div className="flex flex-col gap-4">
      <Card className="p-0">
        <EmptyState
          icon={UserX}
          title="Cliente no encontrado"
          description="Puede que se haya eliminado o que el enlace no sea válido."
          action={
            <Link
              href="/clientes"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-md border border-border-strong bg-surface px-5 text-[15px] font-semibold text-text hover:bg-surface-2"
            >
              Volver a clientes
            </Link>
          }
        />
      </Card>
    </div>
  );
}
