"use client";

import { type FormEvent, useId, useState } from "react";
import { AlertCircle, Building2, Mail, Phone } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  useAppData,
  validarCliente,
  type ErroresCliente,
} from "@/components/providers/app-data-provider";
import { useToast } from "@/components/providers/toast-provider";
import type { CanalOrigen } from "@/lib/types";
import { cn } from "@/lib/utils";

const CANALES: { value: CanalOrigen; label: string }[] = [
  { value: "web", label: "Web" },
  { value: "redes", label: "Redes" },
  { value: "email", label: "Email" },
  { value: "whatsapp", label: "WhatsApp" },
];

/**
 * Alta rápida de cliente (RAU-66). Se renderiza dentro de <Sheet> (bottom sheet
 * en móvil / modal en escritorio). No valida mientras se escribe: los errores
 * solo aparecen tras el primer intento de guardar (`triedSave`) y, a partir de
 * ahí, se recalculan en vivo (al corregir un campo, su error desaparece).
 */
export function NuevoClienteForm({ onDone }: { onDone: () => void }) {
  const { crearCliente } = useAppData();
  const { showToast } = useToast();

  const [nombre, setNombre] = useState("");
  const [empresa, setEmpresa] = useState("");
  const [telefono, setTelefono] = useState("");
  const [email, setEmail] = useState("");
  const [canal, setCanal] = useState<CanalOrigen | null>(null);
  const [nota, setNota] = useState("");
  const [triedSave, setTriedSave] = useState(false);

  // Errores derivados: solo tras el primer intento de guardar y recalculados en
  // cada render, de modo que al corregir un campo su error desaparece en vivo.
  const errors: ErroresCliente = triedSave
    ? validarCliente({ nombre, empresa, telefono, email, canalOrigen: canal, nota })
    : {};

  // Id del texto de contacto (ayuda permanente / error de grupo). Teléfono y
  // Email lo referencian con aria-describedby para que el error sea del grupo.
  const contactoId = useId();
  const contactoError = !!errors.contacto;

  function submit(e: FormEvent) {
    e.preventDefault();
    const res = crearCliente({
      nombre,
      empresa,
      telefono,
      email,
      canalOrigen: canal,
      nota,
    });
    if (!res.ok) {
      setTriedSave(true);
      return;
    }
    showToast({ message: "Cliente añadido" });
    onDone();
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      <Input
        label="Nombre"
        value={nombre}
        onChange={(e) => setNombre(e.target.value)}
        error={errors.nombre}
        placeholder="Marta López"
        autoCapitalize="words"
        autoFocus
      />

      <Input
        label="Empresa"
        value={empresa}
        onChange={(e) => setEmpresa(e.target.value)}
        icon={<Building2 className="h-4 w-4" strokeWidth={1.5} />}
        placeholder="Acme S.L."
      />

      <Input
        label="Teléfono"
        type="tel"
        inputMode="tel"
        value={telefono}
        onChange={(e) => setTelefono(e.target.value)}
        icon={<Phone className="h-4 w-4" strokeWidth={1.5} />}
        placeholder="+34 600 000 000"
        aria-invalid={contactoError || undefined}
        aria-describedby={contactoId}
      />

      <Input
        label="Email"
        type="email"
        inputMode="email"
        autoCapitalize="none"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        error={errors.email}
        icon={<Mail className="h-4 w-4" strokeWidth={1.5} />}
        placeholder="nombre@empresa.es"
        // Solo cuando el error es de grupo (contacto) reasignamos aria al texto
        // común; si el fallo es de formato de email, dejamos que <Input> gestione
        // su propio error (son mutuamente excluyentes: contacto exige email vacío).
        {...(contactoError
          ? { "aria-invalid": true, "aria-describedby": contactoId }
          : {})}
      />

      {/* Ayuda permanente que pasa a error cuando falta el contacto (mismo texto,
          distinta semántica: color + icono + role="alert"). */}
      <p
        id={contactoId}
        role={contactoError ? "alert" : undefined}
        aria-live={contactoError ? "polite" : undefined}
        className={cn(
          "flex items-center gap-1 text-[13px]",
          contactoError ? "text-error-text" : "text-text-subtle",
        )}
      >
        {contactoError && <AlertCircle className="h-3.5 w-3.5" />}
        Indica al menos un teléfono o un email
      </p>

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium text-text">Canal de origen</span>
        <div className="flex flex-wrap gap-2">
          {CANALES.map((c) => {
            const sel = canal === c.value;
            return (
              <button
                key={c.value}
                type="button"
                aria-pressed={sel}
                onClick={() => setCanal(sel ? null : c.value)}
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

      <div className="flex flex-col gap-1.5">
        <label htmlFor="nc-nota" className="text-sm font-medium text-text">
          Nota
        </label>
        <textarea
          id="nc-nota"
          value={nota}
          onChange={(e) => setNota(e.target.value)}
          rows={3}
          placeholder="Detalle del primer contacto, necesidades…"
          className="min-h-[84px] w-full resize-y rounded-md border border-border-strong bg-surface px-3.5 py-3 text-[15px] text-text placeholder:text-text-subtle focus-visible:border-primary"
        />
      </div>

      <Button type="submit" className="w-full">
        Guardar
      </Button>
    </form>
  );
}
