import { HoyClient } from "@/components/hoy/hoy-client";

// Server Component fino: la lógica interactiva vive en HoyClient ("use client").
export default function HoyPage() {
  return <HoyClient />;
}
