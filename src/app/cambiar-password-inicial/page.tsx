"use client";

import { type FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  useAppData,
  validarCambiarPasswordInicial,
} from "@/components/providers/app-data-provider";
import { cn } from "@/lib/utils";

/**
 * Pantalla de cambio obligatorio de contraseña (RAU-87 adenda): a quien
 * inicia sesión con la temporal del bootstrap se le exige fijar una
 * contraseña propia antes de poder usar el resto del CRM. Top-level como
 * /login (sin AppShell) para que no se pueda navegar fuera - el redirect
 * hacia aquí lo hace AuthGate (src/components/auth/auth-gate.tsx), pero la
 * barrera real vive en el backend (requireIdentity).
 *
 * Sin campo de "contraseña actual": el caller ya se autenticó con la
 * temporal para llegar aquí (ver convex/usuarios.ts, cambiarPasswordInicial)
 * - distinto del "Cambiar contraseña" autoservicio de RAU-112, que sí la
 * pedirá.
 */
export default function CambiarPasswordInicialPage() {
  const { authLoaded, currentUser, debeCambiarPassword, cambiarPasswordInicial } =
    useAppData();
  const router = useRouter();

  const [nuevaPassword, setNuevaPassword] = useState("");
  const [repetir, setRepetir] = useState("");
  const [showNueva, setShowNueva] = useState(false);
  const [showRepetir, setShowRepetir] = useState(false);
  const [loading, setLoading] = useState(false);
  const [tried, setTried] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoaded) return;
    if (!currentUser) router.replace("/login");
    else if (!debeCambiarPassword) router.replace("/hoy");
  }, [authLoaded, currentUser, debeCambiarPassword, router]);

  const errores = validarCambiarPasswordInicial(nuevaPassword, repetir);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setTried(true);
    setError(null);
    if (Object.keys(errores).length > 0) return;

    setLoading(true);
    const res = await cambiarPasswordInicial(nuevaPassword);
    if (!res.ok) {
      setError(res.error);
      setLoading(false);
      return;
    }
    router.replace("/hoy");
  }

  // Evita el parpadeo del formulario mientras carga la sesión / si no toca
  // pasar por aquí (sin sesión, o el cambio ya no está pendiente).
  if (!authLoaded || !currentUser || !debeCambiarPassword) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-bg">
        <div className="h-8 w-8 animate-vibe-spin rounded-full border-[3px] border-surface-2 border-t-primary" />
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-bg px-4">
      <div className="w-full max-w-[400px]">
        <div className="mb-6 flex items-center justify-center gap-2">
          <span className="flex h-[34px] w-[34px] items-center justify-center rounded-[9px] bg-primary text-lg font-semibold text-on-primary">
            V
          </span>
          <span className="text-lg font-semibold text-text">Vibe CRM</span>
        </div>

        <div className="rounded-xl border border-border bg-surface p-6 shadow-xs">
          <h1 className="text-xl font-semibold text-text">Crea tu contraseña</h1>
          <p className="mt-1 text-sm text-text-muted">
            Es tu primer inicio de sesión: fija una contraseña propia para continuar.
          </p>

          {error && (
            <div
              role="alert"
              className="mt-4 flex items-center gap-2 rounded-md border border-error bg-error-bg px-3 py-2 text-[13px] text-error-text"
            >
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          <form onSubmit={submit} className="mt-4 flex flex-col gap-4" noValidate>
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="cambiar-pass-nueva"
                className="text-sm font-medium text-text"
              >
                Nueva contraseña
              </label>
              <div className="relative">
                <input
                  id="cambiar-pass-nueva"
                  type={showNueva ? "text" : "password"}
                  autoComplete="new-password"
                  autoFocus
                  value={nuevaPassword}
                  onChange={(e) => setNuevaPassword(e.target.value)}
                  aria-invalid={tried && !!errores.nuevaPassword}
                  aria-describedby={
                    tried && errores.nuevaPassword
                      ? "cambiar-pass-nueva-error"
                      : undefined
                  }
                  className={cn(
                    "h-12 w-full rounded-md border border-border-strong bg-surface px-3.5 pr-11 text-[15px] text-text placeholder:text-text-subtle focus-visible:border-primary",
                    tried && errores.nuevaPassword && "border-error",
                  )}
                />
                <button
                  type="button"
                  onClick={() => setShowNueva((v) => !v)}
                  aria-pressed={showNueva}
                  aria-label={showNueva ? "Ocultar contraseña" : "Mostrar contraseña"}
                  className="absolute right-1.5 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-md text-text-subtle hover:bg-surface-2"
                >
                  {showNueva ? (
                    <EyeOff className="h-5 w-5" strokeWidth={1.5} />
                  ) : (
                    <Eye className="h-5 w-5" strokeWidth={1.5} />
                  )}
                </button>
              </div>
              {tried && errores.nuevaPassword && (
                <p
                  id="cambiar-pass-nueva-error"
                  className="flex items-center gap-1 text-[13px] text-error-text"
                >
                  <AlertCircle className="h-3.5 w-3.5" />
                  {errores.nuevaPassword}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="cambiar-pass-repetir"
                className="text-sm font-medium text-text"
              >
                Repite la contraseña
              </label>
              <div className="relative">
                <input
                  id="cambiar-pass-repetir"
                  type={showRepetir ? "text" : "password"}
                  autoComplete="new-password"
                  value={repetir}
                  onChange={(e) => setRepetir(e.target.value)}
                  aria-invalid={tried && !!errores.repetir}
                  aria-describedby={
                    tried && errores.repetir ? "cambiar-pass-repetir-error" : undefined
                  }
                  className={cn(
                    "h-12 w-full rounded-md border border-border-strong bg-surface px-3.5 pr-11 text-[15px] text-text placeholder:text-text-subtle focus-visible:border-primary",
                    tried && errores.repetir && "border-error",
                  )}
                />
                <button
                  type="button"
                  onClick={() => setShowRepetir((v) => !v)}
                  aria-pressed={showRepetir}
                  aria-label={showRepetir ? "Ocultar contraseña" : "Mostrar contraseña"}
                  className="absolute right-1.5 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-md text-text-subtle hover:bg-surface-2"
                >
                  {showRepetir ? (
                    <EyeOff className="h-5 w-5" strokeWidth={1.5} />
                  ) : (
                    <Eye className="h-5 w-5" strokeWidth={1.5} />
                  )}
                </button>
              </div>
              {tried && errores.repetir && (
                <p
                  id="cambiar-pass-repetir-error"
                  className="flex items-center gap-1 text-[13px] text-error-text"
                >
                  <AlertCircle className="h-3.5 w-3.5" />
                  {errores.repetir}
                </p>
              )}
            </div>

            <Button type="submit" loading={loading} className="w-full">
              Guardar y continuar
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
