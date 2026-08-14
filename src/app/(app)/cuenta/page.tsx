"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAppData } from "@/components/providers/app-data-provider";
import type { Usuario } from "@/lib/types";

const ROL_LABEL: Record<Usuario["rol"], string> = {
  propietaria: "Dueña",
  comercial: "Atiende y vende",
};

// Placeholder de Perfil (RAU-112 hará editar datos / cambiar contraseña) +
// cierre de sesión real (RAU-87).
export default function CuentaPage() {
  const { currentUser, logout } = useAppData();
  const router = useRouter();

  if (!currentUser) return null;

  async function cerrarSesion() {
    // await real: si se navega a /login antes de que signOut() termine,
    // /login puede ver la sesión todavía activa y rebotar de vuelta a /hoy.
    await logout();
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

      <Button
        variant="secondary"
        onClick={() => void cerrarSesion()}
        className="w-full justify-center gap-2"
      >
        <LogOut className="h-4 w-4" strokeWidth={1.5} />
        Cerrar sesión
      </Button>
    </div>
  );
}
