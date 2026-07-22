import { VentasClient } from "@/components/ventas/ventas-client";

// Server Component fino: la lógica interactiva vive en VentasClient ("use client").
export default function VentasPage() {
  return <VentasClient />;
}
