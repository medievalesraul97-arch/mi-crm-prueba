"use client";

import { type KeyboardEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Sheet } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ESTADO_VENTA_BADGE,
  ICONO_VENTA_WRAP,
  IMPORTE_VENTA_CLASE,
} from "@/components/ui/estado-venta-badge";
import { RegistrarVentaForm } from "@/components/hoy/registrar-venta-form";
import { useAppData } from "@/components/providers/app-data-provider";
import { fechaCorta } from "@/lib/date";
import { formatoEuro } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { EstadoVenta, Venta } from "@/lib/types";

type Filtro = "todas" | EstadoVenta;

/** Orden de desempate cuando dos ventas comparten fecha (prototipo `ventasOrden`). */
const ORDEN_ESTADO: Record<EstadoVenta, number> = {
  abierta: 0,
  ganada: 1,
  perdida: 2,
};

const FILTROS: { value: Filtro; label: string }[] = [
  { value: "todas", label: "Todas" },
  { value: "abierta", label: "En marcha" },
  { value: "ganada", label: "Ganadas" },
  { value: "perdida", label: "Perdidas" },
];

/** Mensaje del estado vacío según el filtro activo (textos exactos del diseño). */
const MENSAJE_VACIO: Record<Filtro, string> = {
  todas: "Sin ventas registradas",
  abierta: "Sin oportunidades abiertas",
  ganada: "Sin ventas ganadas",
  perdida: "Sin ventas perdidas",
};

export function VentasClient() {
  const { ventas, clientes, today, loading } = useAppData();
  const router = useRouter();

  const [filtro, setFiltro] = useState<Filtro>("todas");
  const [overlayOpen, setOverlayOpen] = useState(false);

  const clientesPorId = useMemo(
    () => new Map(clientes.map((c) => [c.id, c])),
    [clientes],
  );

  // Todas las ventas ordenadas: fecha desc y, en empate, abierta > ganada > perdida.
  // `fecha` es Date → comparar por getTime() (no por el `!==` de strings del prototipo).
  const ordenadas = useMemo(
    () =>
      [...ventas].sort((a, b) => {
        const d = b.fecha.getTime() - a.fecha.getTime();
        return d !== 0 ? d : ORDEN_ESTADO[a.estado] - ORDEN_ESTADO[b.estado];
      }),
    [ventas],
  );

  const conteos = useMemo(() => {
    const de = (e: EstadoVenta) => ventas.filter((v) => v.estado === e);
    const abiertas = de("abierta");
    const ganadas = de("ganada");
    const suma = (arr: Venta[]) => arr.reduce((m, v) => m + v.importe, 0);
    return {
      totalAbierto: suma(abiertas),
      totalGanado: suma(ganadas),
      abierta: abiertas.length,
      ganada: ganadas.length,
      perdida: de("perdida").length,
      todas: ventas.length,
    };
  }, [ventas]);

  const conteoPorFiltro: Record<Filtro, number> = {
    todas: conteos.todas,
    abierta: conteos.abierta,
    ganada: conteos.ganada,
    perdida: conteos.perdida,
  };

  const filtradas = useMemo(
    () => ordenadas.filter((v) => filtro === "todas" || v.estado === filtro),
    [ordenadas, filtro],
  );

  // Roving tabindex + flechas en los chips (radiogroup de selección única).
  function onChipKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const forward = e.key === "ArrowRight" || e.key === "ArrowDown";
    const backward = e.key === "ArrowLeft" || e.key === "ArrowUp";
    if (!forward && !backward) return;
    e.preventDefault();
    const i = FILTROS.findIndex((f) => f.value === filtro);
    const next = (i + (forward ? 1 : -1) + FILTROS.length) % FILTROS.length;
    setFiltro(FILTROS[next].value);
    const radios = e.currentTarget.querySelectorAll<HTMLButtonElement>(
      '[role="radio"]',
    );
    radios[next]?.focus();
  }

  if (loading || !today) return <VentasSkeleton />;

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <span className="text-xs font-semibold uppercase tracking-[0.06em] text-text-subtle">
            Registro de ventas
          </span>
          <h1 className="text-2xl font-semibold tracking-[-0.011em] text-text">
            Ventas y oportunidades
          </h1>
        </div>
        <Button
          className="hidden shrink-0 md:inline-flex"
          onClick={() => setOverlayOpen(true)}
        >
          Añadir venta
        </Button>
      </header>

      {/* Métricas */}
      <div className="grid grid-cols-2 gap-3">
        <MetricaCard
          label="En marcha"
          valor={formatoEuro(conteos.totalAbierto)}
          valorClase="text-info-text"
          sub={`${conteos.abierta} ${conteos.abierta === 1 ? "oportunidad" : "oportunidades"}`}
        />
        <MetricaCard
          label="Ganado"
          valor={formatoEuro(conteos.totalGanado)}
          valorClase="text-success-text"
          sub={`${conteos.ganada} ${conteos.ganada === 1 ? "venta cerrada" : "ventas cerradas"}`}
        />
      </div>

      {/* Filtro por estado */}
      <div
        role="radiogroup"
        aria-label="Filtrar ventas por estado"
        onKeyDown={onChipKeyDown}
        className="flex gap-2 overflow-x-auto pb-0.5"
      >
        {FILTROS.map((f) => {
          const sel = filtro === f.value;
          return (
            <button
              key={f.value}
              type="button"
              role="radio"
              aria-checked={sel}
              tabIndex={sel ? 0 : -1}
              onClick={() => setFiltro(f.value)}
              className={cn(
                "shrink-0 whitespace-nowrap rounded-md border px-3 py-2 text-sm font-medium transition-colors",
                sel
                  ? "border-primary bg-primary-subtle text-primary"
                  : "border-border-strong bg-surface text-text-muted hover:bg-surface-2",
              )}
            >
              {f.label} · {conteoPorFiltro[f.value]}
            </button>
          );
        })}
      </div>

      {/* Listado / vacío contextual */}
      {filtradas.length === 0 ? (
        <Card className="p-0">
          <EmptyState
            icon={TrendingUp}
            title={MENSAJE_VACIO[filtro]}
            description="Las ventas se registran desde la ficha de cada cliente."
          />
        </Card>
      ) : (
        <Card className="p-0">
          {filtradas.map((v) => (
            <VentaRow
              key={v.id}
              venta={v}
              clienteNombre={clientesPorId.get(v.clienteId)?.nombre ?? "—"}
              onAbrir={() =>
                router.push(`/clientes/${encodeURIComponent(v.clienteId)}`)
              }
            />
          ))}
        </Card>
      )}

      {/* FAB móvil (equivalente al botón "Añadir venta" de la cabecera en escritorio). */}
      <button
        type="button"
        aria-label="Añadir venta"
        onClick={() => setOverlayOpen(true)}
        className="fixed bottom-24 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-on-primary shadow-lg hover:bg-primary-hover md:hidden"
      >
        <Plus className="h-6 w-6" />
      </button>

      <Sheet
        open={overlayOpen}
        onClose={() => setOverlayOpen(false)}
        title="Registrar venta"
      >
        <RegistrarVentaForm onDone={() => setOverlayOpen(false)} />
      </Sheet>
    </div>
  );
}

function MetricaCard({
  label,
  valor,
  valorClase,
  sub,
}: {
  label: string;
  valor: string;
  valorClase: string;
  sub: string;
}) {
  return (
    <Card className="flex flex-col gap-1.5">
      <span className="text-[13px] text-text-muted">{label}</span>
      <span
        className={cn(
          "font-mono text-[28px] font-medium leading-tight tabular-nums",
          valorClase,
        )}
      >
        {valor}
      </span>
      <span className="text-xs text-text-subtle">{sub}</span>
    </Card>
  );
}

function VentaRow({
  venta,
  clienteNombre,
  onAbrir,
}: {
  venta: Venta;
  clienteNombre: string;
  onAbrir: () => void;
}) {
  const badge = ESTADO_VENTA_BADGE[venta.estado];
  return (
    <button
      type="button"
      onClick={onAbrir}
      className="flex w-full items-center gap-3 border-b border-border px-4 py-3.5 text-left last:border-b-0 hover:bg-surface-2"
    >
      <span
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
          ICONO_VENTA_WRAP[venta.estado],
        )}
      >
        <TrendingUp className="h-[18px] w-[18px]" strokeWidth={1.5} />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="truncate text-[15px] font-medium text-text">
          {venta.concepto}
        </span>
        <div className="flex min-w-0 items-center gap-2">
          <Badge tone={badge.tone} className="shrink-0">
            {badge.label}
          </Badge>
          <span className="truncate text-[13px] text-text-muted">
            {clienteNombre}
          </span>
        </div>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <span
          className={cn(
            "font-mono text-[15px] font-semibold tabular-nums",
            IMPORTE_VENTA_CLASE[venta.estado],
          )}
        >
          {formatoEuro(venta.importe)}
        </span>
        <span className="whitespace-nowrap text-xs text-text-subtle">
          {fechaCorta(venta.fecha)}
        </span>
      </div>
    </button>
  );
}

function VentasSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-8 w-64" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Skeleton className="h-[104px] rounded-xl" />
        <Skeleton className="h-[104px] rounded-xl" />
      </div>
      <div className="flex gap-2">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-9 w-24 rounded-md" />
        ))}
      </div>
      <Skeleton className="h-64 rounded-xl" />
    </div>
  );
}
