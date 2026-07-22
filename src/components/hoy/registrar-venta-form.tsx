"use client";

import { type FormEvent, type KeyboardEvent, useId, useState } from "react";
import { User } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  useAppData,
  validarVenta,
  type ErroresVenta,
} from "@/components/providers/app-data-provider";
import { useToast } from "@/components/providers/toast-provider";
import { isoDeFecha, parseFecha, startOfDay } from "@/lib/date";
import type { EstadoVenta } from "@/lib/types";
import { cn } from "@/lib/utils";

// Estados de venta con el color del chip SELECCIONADO por estado (clases literales, como
// `IMPORTE_VENTA_CLASE`). El diseño colorea cada estado con su tono (info/success/error).
const ESTADOS_VENTA: { value: EstadoVenta; label: string; selected: string }[] = [
  { value: "abierta", label: "Oportunidad abierta", selected: "border-info bg-info-bg text-info" },
  { value: "ganada", label: "Ganada", selected: "border-success bg-success-bg text-success" },
  { value: "perdida", label: "Perdida", selected: "border-error bg-error-bg text-error" },
];

/**
 * Registrar venta (RAU-69). Se renderiza dentro de <Sheet>. Reutilizable: si recibe
 * `clienteId` (desde la ficha) oculta el selector y fija el cliente; si no (desde Hoy)
 * muestra el desplegable. Autor automático = usuario de la sesión. Errores en vivo solo tras
 * el primer intento de guardar (`triedSave`), con la misma función pura (`validarVenta`) que
 * usa la mutación.
 */
export function RegistrarVentaForm({
  clienteId,
  onDone,
}: {
  clienteId?: string;
  onDone: () => void;
}) {
  const { clientes, usuarios, currentUser, registrarVenta, today } =
    useAppData();
  const { showToast } = useToast();

  const [clienteSel, setClienteSel] = useState(clienteId ?? "");
  const [concepto, setConcepto] = useState("");
  const [importe, setImporte] = useState("");
  const [estado, setEstado] = useState<EstadoVenta>("abierta");
  const [fecha, setFecha] = useState(isoDeFecha(today ?? new Date()));
  const [triedSave, setTriedSave] = useState(false);

  const mostrarSelector = clienteId === undefined;
  const clienteEfectivo = clienteId ?? clienteSel;
  const autor = currentUser ?? usuarios[0];
  const hoy = today ?? startOfDay(new Date());

  const clienteFieldId = useId();
  const estadoLabelId = useId();

  // Navegación por flechas del radiogroup de estado (selección única): mueve la selección al
  // anterior/siguiente y traslada el foco (roving tabindex).
  function onEstadoKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const forward = e.key === "ArrowRight" || e.key === "ArrowDown";
    const backward = e.key === "ArrowLeft" || e.key === "ArrowUp";
    if (!forward && !backward) return;
    e.preventDefault();
    const i = ESTADOS_VENTA.findIndex((x) => x.value === estado);
    const next =
      (i + (forward ? 1 : -1) + ESTADOS_VENTA.length) % ESTADOS_VENTA.length;
    setEstado(ESTADOS_VENTA[next].value);
    const radios = e.currentTarget.querySelectorAll<HTMLButtonElement>(
      '[role="radio"]',
    );
    radios[next]?.focus();
  }

  // Errores derivados: solo tras el primer intento y recalculados en cada render, así al
  // corregir un campo su error desaparece en vivo.
  const errors: ErroresVenta = triedSave
    ? validarVenta(
        {
          clienteId: clienteEfectivo,
          concepto,
          importe,
          estado,
          fecha: parseFecha(fecha),
        },
        hoy,
      )
    : {};

  function submit(e: FormEvent) {
    e.preventDefault();
    const res = registrarVenta({
      clienteId: clienteEfectivo,
      concepto,
      importe,
      estado,
      fecha: parseFecha(fecha),
    });
    if (!res.ok) {
      setTriedSave(true);
      return;
    }
    showToast({ message: "Venta registrada" });
    onDone();
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      {mostrarSelector && (
        <div className="flex flex-col gap-1.5">
          <label htmlFor={clienteFieldId} className="text-sm font-medium text-text">
            Cliente
          </label>
          <select
            id={clienteFieldId}
            value={clienteSel}
            onChange={(e) => setClienteSel(e.target.value)}
            aria-invalid={!!errors.clienteId}
            aria-describedby={errors.clienteId ? `${clienteFieldId}-error` : undefined}
            className={cn(
              "h-12 w-full rounded-md border bg-surface px-3.5 text-[15px] text-text focus-visible:border-primary",
              errors.clienteId ? "border-error" : "border-border-strong",
            )}
          >
            <option value="">Selecciona un cliente</option>
            {clientes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
                {c.empresa ? ` · ${c.empresa}` : ""}
              </option>
            ))}
          </select>
          {errors.clienteId && (
            <p id={`${clienteFieldId}-error`} className="text-[13px] text-error-text">
              {errors.clienteId}
            </p>
          )}
        </div>
      )}

      <Input
        label="Qué se vende"
        data-autofocus
        value={concepto}
        onChange={(e) => setConcepto(e.target.value)}
        error={errors.concepto}
        placeholder="Licencia anual, servicio…"
        autoCapitalize="sentences"
      />

      <Input
        label="Importe (€)"
        type="tel"
        inputMode="numeric"
        value={importe}
        onChange={(e) => setImporte(e.target.value)}
        error={errors.importe}
        placeholder="1200"
      />

      <div className="flex flex-col gap-2">
        <span id={estadoLabelId} className="text-sm font-medium text-text">
          Estado
        </span>
        {/* Selección única NO deseleccionable → radiogroup (roving tabindex + flechas),
            con color por estado en el chip seleccionado. */}
        <div
          role="radiogroup"
          aria-labelledby={estadoLabelId}
          onKeyDown={onEstadoKeyDown}
          className="flex flex-wrap gap-2"
        >
          {ESTADOS_VENTA.map((x) => {
            const sel = estado === x.value;
            return (
              <button
                key={x.value}
                type="button"
                role="radio"
                aria-checked={sel}
                tabIndex={sel ? 0 : -1}
                onClick={() => setEstado(x.value)}
                className={cn(
                  "rounded-md border px-3.5 py-2 text-sm font-medium transition-colors",
                  sel
                    ? x.selected
                    : "border-border-strong bg-surface text-text-muted hover:bg-surface-2",
                )}
              >
                {x.label}
              </button>
            );
          })}
        </div>
      </div>

      <Input
        label="Fecha"
        type="date"
        value={fecha}
        onChange={(e) => setFecha(e.target.value)}
        error={errors.fecha}
      />

      <div className="flex items-center gap-2 text-[13px] text-text-muted">
        <User className="h-4 w-4 shrink-0 text-text-subtle" strokeWidth={1.5} />
        <span>Se registrará como {autor?.nombre}</span>
      </div>

      <Button type="submit" className="w-full">
        Guardar
      </Button>
    </form>
  );
}
