import { TrendingUp } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";

// Placeholder hasta implementar Ventas y oportunidades (RAU-114).
export default function VentasPage() {
  return (
    <EmptyState
      icon={TrendingUp}
      title="Ventas y oportunidades"
      description="Esta pantalla se implementa en RAU-114."
    />
  );
}
