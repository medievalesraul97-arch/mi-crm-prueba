"use client";

import { type FormEvent, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  useAppData,
  type ErroresSeguimiento,
} from "@/components/providers/app-data-provider";
import { useToast } from "@/components/providers/toast-provider";
import { isoDeFecha, parseFecha } from "@/lib/date";
import { cn } from "@/lib/utils";

/** Formulario mínimo funcional: crea un seguimiento sobre el estado mock. */
export function NuevaTareaForm({ onDone }: { onDone: () => void }) {
  const { clientes, crearSeguimiento, today } = useAppData();
  const { showToast } = useToast();

  const [accion, setAccion] = useState("");
  const [clienteId, setClienteId] = useState("");
  const [fecha, setFecha] = useState(isoDeFecha(today ?? new Date()));
  const [errors, setErrors] = useState<ErroresSeguimiento>({});

  function submit(e: FormEvent) {
    e.preventDefault();
    const res = crearSeguimiento({
      clienteId,
      accion,
      vence: parseFecha(fecha),
    });
    if (!res.ok) {
      setErrors(res.errors);
      return;
    }
    setErrors({});
    showToast({ message: "Tarea creada" });
    onDone();
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      <Input
        label="Qué hay que hacer"
        value={accion}
        onChange={(e) => setAccion(e.target.value)}
        error={errors.accion}
        placeholder="Llamar, enviar propuesta..."
        autoFocus
      />

      <div className="flex flex-col gap-1.5">
        <label htmlFor="nt-cliente" className="text-sm font-medium text-text">
          Cliente
        </label>
        <select
          id="nt-cliente"
          value={clienteId}
          onChange={(e) => setClienteId(e.target.value)}
          aria-invalid={!!errors.clienteId}
          aria-describedby={errors.clienteId ? "nt-cliente-error" : undefined}
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
          <p id="nt-cliente-error" className="text-[13px] text-error-text">
            {errors.clienteId}
          </p>
        )}
      </div>

      <Input
        label="Fecha"
        type="date"
        value={fecha}
        onChange={(e) => setFecha(e.target.value)}
        error={errors.vence}
      />

      <Button type="submit" className="w-full">
        Crear tarea
      </Button>
    </form>
  );
}
