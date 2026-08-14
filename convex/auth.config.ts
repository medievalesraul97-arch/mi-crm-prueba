// Configuración de dominio de @convex-dev/auth (RAU-87). Sin este fichero
// el fallo es silencioso: el login "funciona" del lado del proveedor, pero
// getAuthUserId/ctx.auth.getUserIdentity() devuelven null siempre - es el
// footgun #1 documentado de la librería.
const authConfig = {
  providers: [
    {
      domain: process.env.CONVEX_SITE_URL,
      applicationID: "convex",
    },
  ],
};

export default authConfig;
