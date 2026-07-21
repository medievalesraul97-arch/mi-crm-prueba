import { Users } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";

// Placeholder hasta implementar la lista de clientes (RAU-65).
export default function ClientesPage() {
  return (
    <EmptyState
      icon={Users}
      title="Clientes"
      description="Esta pantalla se implementa en RAU-65."
    />
  );
}
