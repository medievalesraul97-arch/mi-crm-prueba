import { ClientesClient } from "@/components/clientes/clientes-client";

// Server Component fino: la lógica interactiva vive en ClientesClient ("use client").
export default function ClientesPage() {
  return <ClientesClient />;
}
