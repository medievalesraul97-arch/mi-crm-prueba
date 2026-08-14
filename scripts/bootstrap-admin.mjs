// scripts/bootstrap-admin.mjs (temporal - se borra tras usarlo una vez)
// El secreto de bootstrap se genera en memoria, se fija en Convex y se
// retira desde el propio script (nunca lo ve ni lo teclea una persona, no
// es variable de entorno, no es argumento de ningún proceso). Las 2
// contraseñas también se generan aquí, localmente - nadie las inventa - y
// se imprimen SOLO en la terminal de quien ejecuta este script.
//
// "Temporal" no rebaja la categoría de riesgo: hasta que cada persona la
// cambia (obligatorio en su primer login), sigue siendo una credencial de
// acceso real. Por eso este script lo ejecuta el USUARIO, en su propia
// terminal - Claude Code no lo ejecuta ni ve su salida, y las contraseñas
// impresas no deben pegarse de vuelta en esa conversación: pásalas a Marta
// y Carlos por el canal privado que prefieras.
//
// IMPORTANTE: este script es limpieza de MEJOR ESFUERZO (finally +
// SIGINT), no la única defensa - si Node/el equipo mueren sin avisar, no
// hay forma de que un script en ejecución limpie nada. El control real e
// independiente vive en convex/auth.ts (createOrUpdateUser/
// beforeSessionCreation): expiración corta + lista cerrada de emails +
// cambio obligatorio en el primer login, que cierran la ventana aunque
// este script no llegue a retirar nada.
//
// Uso (PowerShell o bash, en tu propia terminal - no vía Claude Code):
//   node scripts/bootstrap-admin.mjs
//   Remove-Item scripts\bootstrap-admin.mjs   (o `rm scripts/bootstrap-admin.mjs`)
import { readFileSync } from "node:fs";
import { randomBytes, randomInt } from "node:crypto";
import { spawn } from "node:child_process";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api.js";

const TTL_MINUTOS = 15;

function leerConvexUrl() {
  const env = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
  const m = env.match(/^NEXT_PUBLIC_CONVEX_URL=(.+)$/m);
  if (!m) throw new Error("No se encontró NEXT_PUBLIC_CONVEX_URL en .env.local");
  return m[1].trim();
}

// Alfabeto sin caracteres ambiguos (0/O, 1/l/I) - se va a teclear a mano en
// el primer login. crypto.randomInt (no randomBytes(...) % length): 256 no
// es múltiplo del tamaño del alfabeto, así que el resto por módulo
// favorecería ligeramente a unos caracteres sobre otros - randomInt hace
// muestreo sin ese sesgo.
function generarPasswordTemporal() {
  const alfabeto = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  let out = "";
  for (let i = 0; i < 16; i++) out += alfabeto[randomInt(alfabeto.length)];
  return out; // 16 caracteres, ~93 bits de entropía, sin sesgo
}

// Fija/retira variables en Convex pasando valores sensibles por stdin del
// subproceso - nunca como argumento, nunca impresos. AUTH_BOOTSTRAP_EXPIRES_AT
// no es sensible (un timestamp no sirve de nada sin el secreto), se pasa
// como argumento normal.
function convexEnv(args, stdinValue) {
  return new Promise((resolve, reject) => {
    const proc = spawn("npx", ["convex", "env", ...args], {
      stdio: [stdinValue !== undefined ? "pipe" : "ignore", "inherit", "inherit"],
      shell: process.platform === "win32",
    });
    if (stdinValue !== undefined) {
      proc.stdin.write(stdinValue);
      proc.stdin.end();
    }
    proc.on("exit", (code) =>
      code === 0 ? resolve() : reject(new Error(`convex env ${args[0]} salió con código ${code}`)),
    );
  });
}

let limpiado = false;
async function limpiar() {
  if (limpiado) return;
  limpiado = true;
  await convexEnv(["remove", "AUTH_BOOTSTRAP_SECRET"]).catch(() => {});
  await convexEnv(["remove", "AUTH_BOOTSTRAP_EXPIRES_AT"]).catch(() => {});
}
// Mejor esfuerzo ante Ctrl+C - no es la defensa real (ver cabecera), pero
// cierra antes si el proceso sigue vivo para recibir la señal.
process.on("SIGINT", async () => {
  await limpiar();
  process.exit(130);
});

const bootstrapSecret = randomBytes(24).toString("hex"); // en memoria, nunca se imprime
const expiresAt = Date.now() + TTL_MINUTOS * 60_000;
await convexEnv(["set", "AUTH_BOOTSTRAP_SECRET"], bootstrapSecret);
await convexEnv(["set", "AUTH_BOOTSTRAP_EXPIRES_AT", String(expiresAt)]);

let martaPasswordTemporal;
let carlosPasswordTemporal;

try {
  const client = new ConvexHttpClient(leerConvexUrl());
  martaPasswordTemporal = generarPasswordTemporal();
  carlosPasswordTemporal = generarPasswordTemporal();

  await client.action(api.auth.signIn, {
    provider: "password",
    params: {
      email: "marta@vibecrm.es",
      password: martaPasswordTemporal,
      flow: "signUp",
      nombre: "Marta Ruiz",
      rol: "propietaria",
      bootstrapSecret,
    },
  });
  console.log("Marta creada.");

  await client.action(api.auth.signIn, {
    provider: "password",
    params: {
      email: "carlos@vibecrm.es",
      password: carlosPasswordTemporal,
      flow: "signUp",
      nombre: "Carlos Gómez",
      rol: "comercial",
      bootstrapSecret,
    },
  });
  console.log("Carlos creado.");

  console.log(
    "\n=== Contraseñas temporales (un solo uso - pásalas por un canal privado; se pedirá cambiarlas en el primer login) ===",
  );
  console.log(`Marta:  ${martaPasswordTemporal}`);
  console.log(`Carlos: ${carlosPasswordTemporal}`);
  console.log(
    "==========================================================================================================\n",
  );
} finally {
  // Se retira pase lo que pase, incluso si un signUp falló a mitad -
  // mejor esfuerzo; la expiración server-side es la garantía real.
  await limpiar();
}
