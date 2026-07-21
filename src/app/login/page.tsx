"use client";

import { type FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAppData } from "@/components/providers/app-data-provider";

// Pantalla de inicio de sesión (login MOCK, RAU-87 hará el real).
// Valida por email contra los usuarios de ejemplo; cualquier contraseña no vacía
// sirve. La sesión persiste en localStorage (ver AppDataProvider).
export default function LoginPage() {
  const { authLoaded, currentUser, login } = useAppData();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Si ya hay sesión, directo a Hoy.
  useEffect(() => {
    if (authLoaded && currentUser) router.replace("/hoy");
  }, [authLoaded, currentUser, router]);

  function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    // ~700ms simulados para dar sensación de carga.
    window.setTimeout(() => {
      const res = login(email, password);
      if (!res.ok) {
        setError(res.error);
        setLoading(false);
        return;
      }
      router.replace("/hoy");
    }, 700);
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
            Entra para ver tus tareas del día.
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
                  className="h-12 w-full rounded-md border border-border-strong bg-surface px-3.5 pr-11 text-[15px] text-text placeholder:text-text-subtle focus-visible:border-primary"
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

          <p className="mt-5 border-t border-border pt-4 text-[13px] text-text-muted">
            Demo: <span className="font-medium text-text">marta@vibecrm.es</span>{" "}
            o <span className="font-medium text-text">carlos@vibecrm.es</span> ·
            cualquier contraseña.
          </p>
        </div>
      </div>
    </div>
  );
}
