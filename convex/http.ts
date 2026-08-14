// Rutas HTTP que @convex-dev/auth necesita (RAU-87).
import { httpRouter } from "convex/server";
import { auth } from "./auth";

const http = httpRouter();
auth.addHttpRoutes(http);
export default http;
