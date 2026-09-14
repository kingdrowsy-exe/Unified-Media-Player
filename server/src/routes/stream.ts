import type { FastifyInstance } from "fastify";
import { resolvePlexStreamUrl } from "../clients/plex.js";
import { resolveSiloStreamUrl } from "../clients/silo.js";
import { liveStreamUrl } from "../clients/xtream.js";

export async function streamRoutes(app: FastifyInstance) {
  app.get("/api/stream/:source/:id", async (request, reply) => {
    const { source, id } = request.params as { source: string; id: string };

    let url: string;
    switch (source) {
      case "plex":
        url = await resolvePlexStreamUrl(id);
        break;
      case "silo":
        url = await resolveSiloStreamUrl(id);
        break;
      case "live":
        url = liveStreamUrl(Number(id));
        break;
      default:
        return reply.code(400).send({ error: `Unknown source: ${source}` });
    }

    return reply.code(302).redirect(url);
  });
}
