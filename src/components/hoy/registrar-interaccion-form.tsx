"use client";

import { type FormEvent, type KeyboardEvent, useId, useState } from "react";
import { User } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  useAppData,
  validarInteraccion,
  type ErroresInteraccion,
} from "@/components/providers/app-data-provider";
import { useToast } from "@/components/providers/toast-provider";
import { isoDeFecha, parseFecha, startOfDay } from "@/lib/date";
import type { CanalInteraccion } from "@/lib/types";
import { cn } from "@/lib/utils";

const CANALES: { value: CanalInteraccion; label: string }[] = [
  { value: "llamada", label: "Llamada" },
  { value: "email", label: "Email" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "en_persona", label: "En persona" },
];

/**
 * Registrar interacción (RAU-116). Se renderiza dentro de <Sheet>. Reutilizable:
 * si recibe `clienteId` (desde la ficha) oculta el selector y fija el cliente; si
 * no (desde Hoy) muestra el desplegable. Autor automático = usuario de la sesión.
 * Errores en vivo solo tras el primer intento de guardar (`triedSave`), con la
 * misma función pura (`validarInteraccion`) que usa la mutación.
 */
export function RegistrarInteraccionForm({
  clienteId,
  onDone,
}: {
  clienteId?: string;
  onDone: () => void;
}) {
  const { clientes, usuarios, currentUser, registrarInteraccion, today } =
    useAppData();
  const { showToast } = useToast();

  const [clienteSel, setClienteSel] = useState(clienteId ?? "");
  const [canal, setCanal] = useState<CanalInteraccion>("llamada");
  const [fecha, setFecha] = useState(isoDeFecha(today ?? new Date()));
  const [texto, setTexto] = useState("");
  const [triedSave, setTriedSave] = useState(false);

  const mostrarSelector = clienteId === undefined;
  const clienteEfectivo = clienteId ?? clienteSel;
  const autor = currentUser ?? usuarios[0];
  const hoy = today ?? startOfDay(new Date());

  const notaId = useId();
  const clienteFieldId = useId();
  const canalLabelId = useId();

  // Navegación por flechas del radiogroup de canal (selección única): mueve la
  // selección al canal anterior/siguiente y traslada el foco (roving tabindex).
  function onCanalKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const forward = e.key === "ArrowRight" || e.key === "ArrowDown";
    const backward = e.key === "ArrowLeft" || e.key === "ArrowUp";
    if (!forward && !backward) return;
    e.preventDefault();
    const i = CANALES.findIndex((c) => c.value === canal);
    const next = (i + (forward ? 1 : -1) + CANALES.length) % CANALES.length;
    setCanal(CANALES[next].value);
    const radios = e.currentTarget.querySelectorAll<HTMLButtonElement>(
      '[role="radio"]',
    );
    radios[next]?.focus();
  }

  // Errores derivados: solo tras el primer intento y recalculados en cada render,
  // así al corregir un campo su error desaparece en vivo.
  const errors: ErroresInteraccion = triedSave
    ? validarInteraccion(
        { clienteId: clienteEfectivo, canal, texto, fecha: parseFecha(fecha) },
        hoy,
      )
    : {};

  function submit(e: FormEvent) {
    e.preventDefault();
    const res = registrarInteraccion({
      clienteId: clienteEfectivo,
      canal,
      texto,
      fecha: parseFecha(fecha),
    });
    if (!res.ok) {
      setTriedSave(true);
      return;
    }
    showToast({ message: "Interacción registrada" });
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
            <option value="">Elige un cliente</option>
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

      <div className="flex flex-col gap-2">
        <span id={canalLabelId} className="text-sm font-medium text-text">
          Canal
        </span>
        {/* Selección única NO deseleccionable → radiogroup (roving tabindex +
            flechas), a diferencia de los chips deseleccionables de otros forms. */}
        <div
          role="radiogroup"
          aria-labelledby={canalLabelId}
          onKeyDown={onCanalKeyDown}
          className="flex flex-wrap gap-2"
        >
          {CANALES.map((c) => {
            const sel = canal === c.value;
            return (
              <button
                key={c.value}
                type="button"
                role="radio"
                aria-checked={sel}
                tabIndex={sel ? 0 : -1}
                onClick={() => setCanal(c.value)}
                className={cn(
                  "rounded-md border px-3.5 py-2 text-sm font-medium transition-colors",
                  sel
                    ? "border-primary bg-primary-subtle text-primary"
                    : "border-border-strong bg-surface text-text-muted hover:bg-surface-2",
                )}
              >
                {c.label}
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

      <div className="flex flex-col gap-1.5">
        <label htmlFor={notaId} className="text-sm font-medium text-text">
          Nota
        </label>
        <textarea
          id={notaId}
          data-autofocus
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          rows={3}
          placeholder="Qué se ha hablado, próximos pasos…"
          aria-invalid={!!errors.texto}
          aria-describedby={errors.texto ? `${notaId}-error` : undefined}
          className={cn(
            "min-h-[84px] w-full resize-y rounded-md border bg-surface px-3.5 py-3 text-[15px] text-text placeholder:text-text-subtle focus-visible:border-primary",
            errors.texto ? "border-error" : "border-border-strong",
          )}
        />
        {errors.texto && (
          <p id={`${notaId}-error`} className="text-[13px] text-error-text">
            {errors.texto}
          </p>
        )}
      </div>

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
