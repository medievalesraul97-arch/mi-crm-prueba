import { redirect } from "next/navigation";

// La app abre siempre en Hoy tras el login (RAU-113 / RAU-76).
export default function Home() {
  redirect("/hoy");
}
