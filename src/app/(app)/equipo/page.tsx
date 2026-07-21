"use client";

import { Shield, Users } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { useAppData } from "@/components/providers/app-data-provider";

// Cliente porque depende del rol del usuario actual.
// NOTA: el control de acceso aquí es SOLO demo/UX (mock), NO seguridad real.
// La autorización de verdad vive en el backend (RAU-88).
export default function EquipoPage() {
  const { currentUser } = useAppData();

  if (currentUser.rol !== "propietaria") {
    return (
      <EmptyState
        icon={Shield}
        title="Acceso restringido"
        description="Solo la dueña puede gestionar el equipo."
      />
    );
  }

  return (
    <EmptyState
      icon={Users}
      title="Equipo"
      description="La gestión de usuarios se implementa en RAU-111."
    />
  );
}
