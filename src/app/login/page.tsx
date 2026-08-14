"use client";

import { type FormEvent, Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertCircle, Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  useAppData,
  validarLogin,
} from "@/components/providers/app-data-provider";
import { cn } from "@/lib/utils";

// Lee `?code=`/`?oauthIntento=` de la URL tras volver de Google (RAU-213) y
// dispara el resultado correspondiente. Aislado en su propio componente
// envuelto en <Suspense> porque `useSearchParams` lo exige en build de
// producción (si no, "Missing Suspense boundary" - confirmado contra la
// doc de Next.js empaquetada en node_modules/next/dist/docs, ver AGENTS.md).
function GoogleRedirectHandler({
  onCode,
  onRechazo,
}: {
  onCode: (code: string) => void;
  onRechazo: () => void;
}) {
  const searchParams = useSearchParams();
  const router = useRouter();
  // Evita procesar el mismo `code`/`oauthIntento` dos veces: en React
  // Strict Mode (dev) por el doble-invoke deliberado de efectos, y en
  // cualquier entorno si este componente llegara a desmontarse y
  // remontarse mientras el `code` sigue en la URL (por eso además
  // LoginPage mantiene un único contenedor raíz estable - ver comentario
  // ahí). Mismo motivo que el propio @convex-dev/auth usa un ref análogo
  // (`signingInWithCodeFromURL`) en su manejo automático.
  const manejado = useRef(false);

  useEffect(() => {
    if (manejado.current) return;
    const code = searchParams.get("code");
    const oauthIntento = searchParams.get("oauthIntento");
    if (!code && !oauthIntento) return;
    manejado.current = true;
    router.replace("/login");
    if (code) onCode(code);
    else onRechazo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  return null;
}

// Pantalla de inicio de sesión (RAU-87, autenticación real vía Convex Auth;
// RAU-213 añade Google conviviendo con el login por contraseña). Validación
// inline (email con formato válido, contraseña no vacía) solo tras el
// primer intento de envío, mismo patrón que el resto de formularios del CRM
// (ver validarCliente et al.).
export default function LoginPage() {
  const { authLoaded, currentUser, login, loginConGoogle, completarLoginGoogle } =
    useAppData();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [tried, setTried] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Si ya hay sesión, directo a Hoy.
  useEffect(() => {
    if (authLoaded && currentUser) router.replace("/hoy");
  }, [authLoaded, currentUser, router]);

  async function onGoogleCode(code: string) {
    setError(null);
    setGoogleLoading(true);
    const res = await completarLoginGoogle(code);
    setGoogleLoading(false);
    if (!res.ok) setError(res.error);
  }

  function onGoogleRechazo() {
    setError(
      "No se pudo completar el acceso con Google. Si tu cuenta no está autorizada, pide que te den de alta.",
    );
  }

  async function onGoogleClick() {
    setError(null);
    setGoogleLoading(true);
    const res = await loginConGoogle();
    // Solo se llega aquí si `loginConGoogle` falló ANTES de redirigir
    // (p. ej. red caída) - en el caso normal, el navegador ya navegó fuera
    // de esta página y este código nunca continúa.
    if (!res.ok) {
      setError(res.error);
      setGoogleLoading(false);
    }
  }

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

  // Un único árbol raíz para las dos vistas (cargando / formulario): si
  // cada una tuviera su propio `return` con un elemento raíz distinto
  // (antes: `<>` en una y `<div>` en la otra), React desmonta y vuelve a
  // montar TODO lo de dentro al cambiar de una a otra - incluido
  // GoogleRedirectHandler, justo mientras `authLoaded` pasa de `false` a
  // `true` con `currentUser` aún `null` (la ventana en la que se procesa
  // el `code`). El remount reinicia su `useRef` de "ya procesado" y vuelve
  // a canjear el MISMO `code` de un solo uso una segunda vez -> la
  // primera llamada tiene éxito, la segunda falla ("Invalid verification
  // code") y su error puede pisar en pantalla el resultado bueno. Con un
  // único `<div>` estable, GoogleRedirectHandler se monta una sola vez.
  const mostrarCargando = !authLoaded || currentUser;

  return (
    <div className="flex min-h-dvh items-center justify-center bg-bg px-4">
      <Suspense fallback={null}>
        <GoogleRedirectHandler onCode={onGoogleCode} onRechazo={onGoogleRechazo} />
      </Suspense>
      {mostrarCargando ? (
        <div className="h-8 w-8 animate-vibe-spin rounded-full border-[3px] border-surface-2 border-t-primary" />
      ) : (
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

            <Button
              type="button"
              variant="secondary"
              className="mt-4 w-full"
              loading={googleLoading}
              onClick={onGoogleClick}
            >
              Continuar con Google
            </Button>

            <div className="my-4 flex items-center gap-3 text-[13px] text-text-subtle">
              <div className="h-px flex-1 bg-border" />
              o
              <div className="h-px flex-1 bg-border" />
            </div>

            <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
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
      )}
    </div>
  );
}
