"use client";

import { type FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  useAppData,
  validarLogin,
} from "@/components/providers/app-data-provider";
import { cn } from "@/lib/utils";

// Pantalla de inicio de sesión (RAU-87, autenticación real vía Convex Auth).
// Validación inline (email con formato válido, contraseña no vacía) solo tras
// el primer intento de envío, mismo patrón que el resto de formularios del
// CRM (ver validarCliente et al.).
export default function LoginPage() {
  const { authLoaded, currentUser, login } = useAppData();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [tried, setTried] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Si ya hay sesión, directo a Hoy.
  useEffect(() => {
    if (authLoaded && currentUser) router.replace("/hoy");
  }, [authLoaded, currentUser, router]);

  const errores = validarLogin(email, password);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setTried(true);
    setError(null);
    if (Object.keys(errores).length > 0) return;

    setLoading(true);
    const res = await login(email, password);
    if (!res.ok) {
      setError(res.error);
      setLoading(false);
      return;
    }
    router.replace("/hoy");
  }

  // Evita el parpadeo del formulario mientras carga la sesión / si ya hay una.
  if (!authLoaded || currentUser) {
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
          <h1 className="text-xl font-semibold text-text">Inicia sesión</h1>
          <p className="mt-1 text-sm text-text-muted">
            Accede a tu CRM para gestionar clientes y seguimientos.
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
            <Input
              label="Email"
              type="email"
              autoComplete="email"
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@email.com"
              error={tried ? errores.email : undefined}
            />

            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="login-pass"
                className="text-sm font-medium text-text"
              >
                Contraseña
              </label>
              <div className="relative">
                <input
                  id="login-pass"
                  type={showPass ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  aria-invalid={tried && !!errores.password}
                  aria-describedby={
                    tried && errores.password ? "login-pass-error" : undefined
                  }
                  className={cn(
                    "h-12 w-full rounded-md border border-border-strong bg-surface px-3.5 pr-11 text-[15px] text-text placeholder:text-text-subtle focus-visible:border-primary",
                    tried && errores.password && "border-error",
                  )}
                />
                <button
                  type="button"
                  onClick={() => setShowPass((v) => !v)}
                  aria-pressed={showPass}
                  aria-label={showPass ? "Ocultar contraseña" : "Mostrar contraseña"}
                  className="absolute right-1.5 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-md text-text-subtle hover:bg-surface-2"
                >
                  {showPass ? (
                    <EyeOff className="h-5 w-5" strokeWidth={1.5} />
                  ) : (
                    <Eye className="h-5 w-5" strokeWidth={1.5} />
                  )}
                </button>
              </div>
              {tried && errores.password && (
                <p
                  id="login-pass-error"
                  className="flex items-center gap-1 text-[13px] text-error-text"
                >
                  <AlertCircle className="h-3.5 w-3.5" />
                  {errores.password}
                </p>
              )}
            </div>

            <Button type="submit" loading={loading} className="w-full">
              Entrar
            </Button>
          </form>

          <button
            type="button"
            className="mt-4 rounded-md text-[13px] font-medium text-primary"
          >
            ¿Olvidaste tu contraseña?
          </button>
        </div>
      </div>
    </div>
  );
}
