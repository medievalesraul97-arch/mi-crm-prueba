"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAppData } from "@/components/providers/app-data-provider";
import type { Usuario } from "@/lib/types";

const ROL_LABEL: Record<Usuario["rol"], string> = {
  propietaria: "Dueña",
  comercial: "Atiende y vende",
};

// Placeholder de Perfil (RAU-112) + cierre de sesión + conmutador de usuario
// (ayuda de demo para probar el gating por rol; el login real es RAU-87).
export default function CuentaPage() {
  const { currentUser, usuarios, setCurrentUser, logout } = useAppData();
  const router = useRouter();

  if (!currentUser) return null;

  function cerrarSesion() {
    logout();
    router.replace("/login");
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-xs font-medium uppercase tracking-[0.06em] text-text-subtle">
          Mi cuenta
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-text">Perfil</h1>
      </div>

      <Card className="flex items-center gap-4">
        <Avatar name={currentUser.nombre} className="h-14 w-14 text-lg" />
        <div className="min-w-0">
          <p className="truncate text-lg font-semibold text-text">
            {currentUser.nombre}
          </p>
          <p className="truncate text-sm text-text-muted">{currentUser.email}</p>
          <Badge tone="primary" className="mt-2">
            {ROL_LABEL[currentUser.rol]}
          </Badge>
        </div>
      </Card>

      <Card>
        <p className="text-[15px] font-semibold text-text">
          Cambiar usuario (demo)
        </p>
        <p className="mt-1 text-[13px] text-text-muted">
          Solo para probar el gating por rol. El inicio de sesión real es RAU-87.
        </p>
        <div className="mt-4 flex flex-col gap-2">
          {usuarios.map((u) => {
            const activo = u.id === currentUser.id;
            return (
              <button
                key={u.id}
                type="button"
                onClick={() => setCurrentUser(u.id)}
                aria-pressed={activo}
                className={cn(
                  "flex items-center gap-3 rounded-md border p-3 text-left transition-colors",
                  activo
                    ? "border-primary bg-primary-subtle"
                    : "border-border-strong hover:bg-surface-2",
                )}
              >
                <Avatar name={u.nombre} variant={activo ? "primary" : "neutral"} />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-text">
                    {u.nombre}
                  </span>
                  <span className="block truncate text-[13px] text-text-muted">
                    {ROL_LABEL[u.rol]}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </Card>

      <Button
        variant="secondary"
        onClick={cerrarSesion}
        className="w-full justify-center gap-2"
      >
        <LogOut className="h-4 w-4" strokeWidth={1.5} />
        Cerrar sesión
      </Button>
    </div>
  );
}
