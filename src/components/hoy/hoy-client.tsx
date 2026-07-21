"use client";

import { useState } from "react";
import { CircleCheckBig } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { useAppData } from "@/components/providers/app-data-provider";
import { useToast } from "@/components/providers/toast-provider";
import { HoyHeader } from "./hoy-header";
import { QuickActions, AccionOverlay, type Accion } from "./quick-actions";
import { SeguimientoSection } from "./seguimiento-section";

export function HoyClient() {
  const {
    loading,
    today,
    atrasados,
    paraHoy,
    pendientesCount,
    marcarHecho,
    deshacer,
  } = useAppData();
  const { showToast } = useToast();

  const [overlay, setOverlay] = useState<Accion | null>(null);

  function toggle(id: string) {
    marcarHecho(id);
    showToast({
      message: "Seguimiento completado",
      actionLabel: "Deshacer",
      onAction: () => deshacer(id),
    });
  }

  function abrirFicha() {
    showToast({ message: "La ficha de cliente llega en RAU-68" });
  }

  if (loading || !today) return <HoySkeleton />;

  const vacio = atrasados.length === 0 && paraHoy.length === 0;

  return (
    <div className="flex flex-col gap-6">
      <HoyHeader today={today} count={pendientesCount} />
      <QuickActions onOpen={setOverlay} />

      {vacio ? (
        <EmptyState
          icon={CircleCheckBig}
          title="No hay seguimientos para hoy"
          description="Estás al día. Disfruta del día o añade un nuevo seguimiento."
          action={
            <Button onClick={() => setOverlay("tarea")}>Nueva tarea</Button>
          }
        />
      ) : (
        <div className="flex flex-col gap-4">
          <SeguimientoSection
            titulo="Atrasados"
            tone="error"
            items={atrasados}
            today={today}
            onToggle={toggle}
            onAbrirFicha={abrirFicha}
          />
          <SeguimientoSection
            titulo="Para hoy"
            tone="primary"
            items={paraHoy}
            today={today}
            onToggle={toggle}
            onAbrirFicha={abrirFicha}
          />
        </div>
      )}

      <AccionOverlay abierta={overlay} onClose={() => setOverlay(null)} />
    </div>
  );
}

function HoySkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-3 w-40" />
        <Skeleton className="h-8 w-52" />
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-[104px] rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-40 rounded-xl" />
    </div>
  );
}
