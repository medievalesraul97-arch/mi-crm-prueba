import { FichaClienteClient } from "@/components/clientes/ficha-cliente-client";

// Server Component fino: la ficha interactiva vive en FichaClienteClient ("use client").
// Next 16: `params` es una Promise y hay que await-earla antes de leer el segmento.
export default async function FichaClientePage({
  params,
}: PageProps<"/clientes/[id]">) {
  const { id } = await params;
  return <FichaClienteClient clienteId={id} />;
}
