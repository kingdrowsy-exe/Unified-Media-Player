import type { FastifyInstance } from "fastify";
import { Readable } from "node:stream";
import { resolvePlexStreamUrl } from "../clients/plex.js";
import { resolveSiloStreamUrl } from "../clients/silo.js";
import { liveStreamUrl } from "../clients/xtream.js";

export async function streamRoutes(app: FastifyInstance) {
  app.get("/api/stream/:source/:id", async (request, reply) => {
    const { source, id } = request.params as { source: string; id: string };

    if (source === "silo") {
      // Unlike Plex/Xtream, Silo's stream endpoint requires an Authorization header
      // (not just a token embedded in the URL), which a 302 redirect can't hand off to
      // the browser - so we proxy the video through this server instead of redirecting.
      // Note: Silo's endpoint doesn't support Range requests, so seeking is limited to
      // whatever the browser can do with an already-buffered progressive download.
      const { url, accessToken } = await resolveSiloStreamUrl(id);
      const upstream = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
      if (!upstream.ok || !upstream.body) {
        return reply.code(502).send({ error: "Failed to reach Silo stream" });
      }
      reply.header("content-type", upstream.headers.get("content-type") ?? "video/mp4");
      const length = upstream.headers.get("content-length");
      if (length) reply.header("content-length", length);
      return reply.send(Readable.fromWeb(upstream.body as Parameters<typeof Readable.fromWeb>[0]));
    }

    let url: string;
    switch (source) {
      case "plex":
        url = await resolvePlexStreamUrl(id);
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
