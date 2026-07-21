"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface CheckRedondoProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** Etiqueta accesible (p. ej. "Marcar como hecho: Llamar a Laura"). */
  label: string;
}

/**
 * Checkbox redondo "marcar hecho": `<input type="checkbox">` nativo (oculto
 * visualmente) dentro de un área táctil de 44x44px, con un círculo visual de
 * ~22px. El foco del input pinta el anillo verde sobre el círculo.
 */
export function CheckRedondo({ checked, onChange, label }: CheckRedondoProps) {
  return (
    <label className="inline-flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        aria-label={label}
        className="peer sr-only"
      />
      <span
        className={cn(
          "flex h-[22px] w-[22px] items-center justify-center rounded-full border-2 transition-colors",
          "peer-focus-visible:shadow-[0_0_0_2px_var(--color-surface),0_0_0_4px_var(--color-focus)]",
          checked ? "border-primary bg-primary" : "border-border-strong",
        )}
      >
        {checked && (
          <Check className="h-3.5 w-3.5 text-on-primary" strokeWidth={3} />
        )}
      </span>
    </label>
  );
}
