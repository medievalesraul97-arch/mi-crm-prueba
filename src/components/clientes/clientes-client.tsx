"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Search, Users, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet } from "@/components/ui/sheet";
import { useAppData } from "@/components/providers/app-data-provider";
import { useToast } from "@/components/providers/toast-provider";
import { NuevoClienteForm } from "@/components/hoy/nuevo-cliente-form";
import { ClienteRow } from "./cliente-row";

/** Dígitos de un texto (para comparar teléfonos ignorando espacios y símbolos). */
function soloDigitos(s: string): string {
  return s.replace(/[^0-9]/g, "");
}

export function ClientesClient() {
  const { clientes, loading, today } = useAppData();
  const { showToast } = useToast();

  const [query, setQuery] = useState("");
  const [overlayOpen, setOverlayOpen] = useState(false);
  const [skeleton, setSkeleton] = useState(true);

  // Skeleton artificial (~750 ms) al entrar a la pestaña, como el diseño.
  useEffect(() => {
    const t = setTimeout(() => setSkeleton(false), 750);
    return () => clearTimeout(t);
  }, []);

  const showSkeleton = loading || skeleton;

  const ordenados = useMemo(
    () =>
      [...clientes].sort(
        (a, b) =>
          (b.fechaUltimoContacto?.getTime() ?? 0) -
          (a.fechaUltimoContacto?.getTime() ?? 0),
      ),
    [clientes],
  );

  const q = query.trim().toLowerCase();
  const qPhone = soloDigitos(q);
  const filtrados = useMemo(
    () =>
      ordenados.filter((c) => {
        if (!q) return true;
        return (
          c.nombre.toLowerCase().includes(q) ||
          (c.email ?? "").toLowerCase().includes(q) ||
          (qPhone.length > 1 && soloDigitos(c.telefono ?? "").includes(qPhone))
        );
      }),
    [ordenados, q, qPhone],
  );

  const hayClientes = clientes.length > 0;
  const eyebrow = q
    ? `${filtrados.length} ${filtrados.length === 1 ? "resultado" : "resultados"}`
    : `${clientes.length} ${clientes.length === 1 ? "cliente" : "clientes"}`;

  function abrirFicha() {
    showToast({ message: "La ficha de cliente llega en RAU-68" });
  }

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold text-text">Clientes</h1>
        {!loading && (
          <Button
            className="hidden md:inline-flex"
            onClick={() => setOverlayOpen(true)}
          >
            Nuevo cliente
          </Button>
        )}
      </header>

      <div className="relative">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar por nombre, teléfono o email"
          icon={<Search className="h-4 w-4" strokeWidth={1.5} />}
          aria-label="Buscar clientes"
        />
        {query && (
          <button
            type="button"
            aria-label="Limpiar búsqueda"
            onClick={() => setQuery("")}
            className="absolute right-1.5 top-1.5 flex h-9 w-9 items-center justify-center rounded-md text-text-subtle hover:bg-surface-2"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {!showSkeleton && (
        <span className="text-xs font-semibold uppercase tracking-[0.06em] text-text-subtle">
          {eyebrow}
        </span>
      )}

      {showSkeleton ? (
        <ClientesSkeleton />
      ) : !hayClientes ? (
        <Card className="p-0">
          <EmptyState
            icon={Users}
            title="Sin clientes todavía"
            description="Añade tu primer cliente para empezar a vender."
            action={
              <Button onClick={() => setOverlayOpen(true)}>Añadir cliente</Button>
            }
          />
        </Card>
      ) : filtrados.length === 0 ? (
        <Card className="p-0">
          <EmptyState
            icon={Search}
            title="Sin resultados"
            description="No hay clientes que coincidan con tu búsqueda."
            action={
              <Button variant="secondary" onClick={() => setQuery("")}>
                Limpiar búsqueda
              </Button>
            }
          />
        </Card>
      ) : (
        <Card className="p-0">
          {filtrados.map((c) => (
            <ClienteRow
              key={c.id}
              cliente={c}
              today={today}
              onAbrirFicha={abrirFicha}
            />
          ))}
        </Card>
      )}

      {!loading && (
        <button
          type="button"
          aria-label="Nuevo cliente"
          onClick={() => setOverlayOpen(true)}
          className="fixed bottom-24 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-on-primary shadow-lg hover:bg-primary-hover md:hidden"
        >
          <Plus className="h-6 w-6" />
        </button>
      )}

      <Sheet
        open={overlayOpen}
        onClose={() => setOverlayOpen(false)}
        title="Nuevo cliente"
      >
        <NuevoClienteForm onDone={() => setOverlayOpen(false)} />
      </Sheet>
    </div>
  );
}

/** 6 filas de carga (avatar + 2 líneas), como el diseño. */
function ClientesSkeleton() {
  return (
    <Card className="p-0">
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <div
          key={i}
          className="flex items-center gap-3 border-b border-border px-4 py-3.5 last:border-b-0"
        >
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-3 w-1/3" />
            <Skeleton className="h-2.5 w-3/5" />
          </div>
        </div>
      ))}
    </Card>
  );
}
