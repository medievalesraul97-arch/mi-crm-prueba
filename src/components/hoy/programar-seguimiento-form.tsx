"use client";

import { type FormEvent, type KeyboardEvent, useId, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  useAppData,
  validarSeguimiento,
  type ErroresSeguimiento,
} from "@/components/providers/app-data-provider";
import { useToast } from "@/components/providers/toast-provider";
import { isoDeFecha, parseFecha } from "@/lib/date";
import { cn } from "@/lib/utils";

/**
 * Programar seguimiento (RAU-72). Se renderiza dentro de <Sheet>, siempre desde la
 * ficha de un cliente → `clienteId` fijo, sin selector. Responsable elegible (chips
 * en radiogroup), por defecto el usuario de la sesión. La fecha viene precargada a
 * hoy (como el prototipo y los forms hermanos); no hay restricción de futuro (un
 * seguimiento vence en el futuro por diseño). Errores en vivo solo tras el primer
 * intento de guardar (`triedSave`), con la misma función pura (`validarSeguimiento`)
 * que usa la mutación.
 */
export function ProgramarSeguimientoForm({
  clienteId,
  onDone,
}: {
  clienteId: string;
  onDone: () => void;
}) {
  const { usuarios, currentUser, crearSeguimiento, today } = useAppData();
  const { showToast } = useToast();

  const [accion, setAccion] = useState("");
  const [fecha, setFecha] = useState(isoDeFecha(today ?? new Date()));
  const [responsableId, setResponsableId] = useState(
    currentUser?.id ?? usuarios[0].id,
  );
  const [triedSave, setTriedSave] = useState(false);

  const responsableLabelId = useId();

  // Navegación por flechas del radiogroup de responsable (selección única): mueve la
  // selección al anterior/siguiente y traslada el foco (roving tabindex).
  function onResponsableKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const forward = e.key === "ArrowRight" || e.key === "ArrowDown";
    const backward = e.key === "ArrowLeft" || e.key === "ArrowUp";
    if (!forward && !backward) return;
    e.preventDefault();
    const i = usuarios.findIndex((u) => u.id === responsableId);
    const next = (i + (forward ? 1 : -1) + usuarios.length) % usuarios.length;
    setResponsableId(usuarios[next].id);
    const radios = e.currentTarget.querySelectorAll<HTMLButtonElement>(
      '[role="radio"]',
    );
    radios[next]?.focus();
  }

  // Errores derivados: solo tras el primer intento y recalculados en cada render,
  // así al corregir un campo su error desaparece en vivo.
  const errors: ErroresSeguimiento = triedSave
    ? validarSeguimiento({
        clienteId,
        accion,
        vence: parseFecha(fecha),
        responsableId,
      })
    : {};

  function submit(e: FormEvent) {
    e.preventDefault();
    const res = crearSeguimiento({
      clienteId,
      accion,
      vence: parseFecha(fecha),
      responsableId,
    });
    if (!res.ok) {
      setTriedSave(true);
      return;
    }
    showToast({ message: "Seguimiento programado" });
    onDone();
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      <Input
        label="Qué hay que hacer"
        data-autofocus
        value={accion}
        onChange={(e) => setAccion(e.target.value)}
        error={errors.accion}
        placeholder="Llamar para cerrar la propuesta"
        autoCapitalize="sentences"
      />

      <Input
        label="Fecha"
        type="date"
        value={fecha}
        onChange={(e) => setFecha(e.target.value)}
        error={errors.vence}
      />

      <div className="flex flex-col gap-2">
        <span id={responsableLabelId} className="text-sm font-medium text-text">
          Responsable
        </span>
        {/* Selección única NO deseleccionable → radiogroup (roving tabindex +
            flechas), como el canal en RegistrarInteraccionForm. */}
        <div
          role="radiogroup"
          aria-labelledby={responsableLabelId}
          onKeyDown={onResponsableKeyDown}
          className="flex flex-wrap gap-2"
        >
          {usuarios.map((u) => {
            const sel = responsableId === u.id;
            return (
              <button
                key={u.id}
                type="button"
                role="radio"
                aria-checked={sel}
                tabIndex={sel ? 0 : -1}
                onClick={() => setResponsableId(u.id)}
                className={cn(
                  "rounded-md border px-3.5 py-2 text-sm font-medium transition-colors",
                  sel
                    ? "border-primary bg-primary-subtle text-primary"
                    : "border-border-strong bg-surface text-text-muted hover:bg-surface-2",
                )}
              >
                {u.nombre}
              </button>
            );
          })}
        </div>
      </div>

      <Button type="submit" className="w-full">
        Guardar
      </Button>
    </form>
  );
}
