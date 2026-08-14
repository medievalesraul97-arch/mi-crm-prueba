// scripts/reemitir-password-temporal.mjs (temporal - se borra tras usarlo)
// Procedimiento de recuperación (RAU-87 adenda): reemite una contraseña
// temporal para una cuenta cuyo cambio obligatorio sigue pendiente - p. ej.
// la anterior caducó (48h) sin haberse usado. Mismo patrón de seguridad que
// bootstrap-admin.mjs: el secreto de bootstrap se genera en memoria, se fija
// en Convex por stdin, se usa y se retira desde el propio script - nunca
// visible. La nueva temporal también se genera aquí y se imprime SOLO en la
// terminal de quien ejecuta este script.
//
// "Temporal" no rebaja la categoría de riesgo: lo mismo que
// bootstrap-admin.mjs, este script lo ejecuta el USUARIO, en su propia
// terminal - Claude Code no lo ejecuta ni ve su salida, y la contraseña
// impresa no debe pegarse de vuelta en esa conversación.
//
// Uso (PowerShell o bash, en tu propia terminal - no vía Claude Code):
//   node scripts/reemitir-password-temporal.mjs marta@vibecrm.es
import { readFileSync } from "node:fs";
import { randomBytes, randomInt } from "node:crypto";
import { spawn } from "node:child_process";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api.js";

const TTL_MINUTOS = 15;

const email = process.argv[2];
if (!email) {
  console.error("Uso: node scripts/reemitir-password-temporal.mjs <email>");
  process.exit(1);
}

function leerConvexUrl() {
  const env = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
  const m = env.match(/^NEXT_PUBLIC_CONVEX_URL=(.+)$/m);
  if (!m) throw new Error("No se encontró NEXT_PUBLIC_CONVEX_URL en .env.local");
  return m[1].trim();
}

// Alfabeto sin caracteres ambiguos (0/O, 1/l/I) - se va a teclear a mano.
// crypto.randomInt (no randomBytes(...) % length) para no sesgar el
// muestreo - mismo criterio que bootstrap-admin.mjs.
function generarPasswordTemporal() {
  const alfabeto = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  let out = "";
  for (let i = 0; i < 16; i++) out += alfabeto[randomInt(alfabeto.length)];
  return out; // 16 caracteres, ~93 bits de entropía, sin sesgo
}

// Fija/retira variables en Convex pasando valores sensibles por stdin del
// subproceso - nunca como argumento, nunca impresos.
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
process.on("SIGINT", async () => {
  await limpiar();
  process.exit(130);
});

const bootstrapSecret = randomBytes(24).toString("hex"); // en memoria, nunca se imprime
const expiresAt = Date.now() + TTL_MINUTOS * 60_000;
await convexEnv(["set", "AUTH_BOOTSTRAP_SECRET"], bootstrapSecret);
await convexEnv(["set", "AUTH_BOOTSTRAP_EXPIRES_AT", String(expiresAt)]);

try {
  const client = new ConvexHttpClient(leerConvexUrl());
  const nuevaTemporal = generarPasswordTemporal();

  await client.action(api.usuarios.reemitirPasswordTemporal, {
    email,
    nuevaPasswordTemporal: nuevaTemporal,
    bootstrapSecret,
  });

  console.log(
    `\n=== Nueva contraseña temporal para ${email} (un solo uso - pásala por un canal privado) ===`,
  );
  console.log(nuevaTemporal);
  console.log(
    "=================================================================================\n",
  );
} finally {
  await limpiar();
}
