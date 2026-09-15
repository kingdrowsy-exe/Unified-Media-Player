import path from "node:path";
import { fileURLToPath } from "node:url";
import Fastify from "fastify";
import cors from "@fastify/cors";
import fastifyStatic from "@fastify/static";
import { config } from "./config.js";
import { NotConfiguredError } from "./settingsStore.js";
import { onDemandRoutes } from "./routes/ondemand.js";
import { liveRoutes } from "./routes/live.js";
import { streamRoutes } from "./routes/stream.js";
import { settingsRoutes } from "./routes/settings.js";
import { popularRoutes } from "./routes/popular.js";
import { detailsRoutes } from "./routes/details.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  const app = Fastify({ logger: true });

  await app.register(cors, { origin: true });

  app.setErrorHandler((err: Error, request, reply) => {
    if (err instanceof NotConfiguredError) {
      reply.code(409).send({ error: "not_configured", service: err.service });
      return;
    }
    request.log.error(err);
    reply.code(500).send({ error: "internal_error", message: err.message });
  });

  await app.register(settingsRoutes);
  await app.register(onDemandRoutes);
  await app.register(popularRoutes);
  await app.register(liveRoutes);
  await app.register(streamRoutes);
  await app.register(detailsRoutes);

  const webDist = path.join(__dirname, "../../web/dist");
  await app.register(fastifyStatic, { root: webDist, wildcard: false });
  app.setNotFoundHandler((request, reply) => {
    if (request.raw.url?.startsWith("/api")) {
      reply.code(404).send({ error: "Not found" });
      return;
    }
    reply.sendFile("index.html");
  });

  await app.listen({ port: config.port, host: "0.0.0.0" });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
