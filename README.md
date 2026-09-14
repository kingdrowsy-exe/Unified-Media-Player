# Unified Media Hub

Aggregator client that unifies a Plex server, a Silo server, and an Xtream Codes IPTV
subscription into one browser UI:

- **Live TV** — IPTV channel list + EPG, streamed directly from the Xtream Codes provider.
- **On Demand** — merged Plex + Silo library, deduped by title + year.

This does not build a new media server — it's a thin API layer over the three existing
services, plus a UI that presents them together.

## Setup

```bash
npm install
cp .env.example .env
```

`.env` only holds `PORT` and `CACHE_TTL_SECONDS` — there's nothing else to fill in by hand.

## Run (dev)

```bash
npm run dev
```

Starts Fastify on `PORT` (default 4000) and Vite on 5173, with Vite proxying `/api` to Fastify.
Open http://localhost:5173 — on first run you'll land on **Settings**:

- **Plex** — click "Link Plex Account." You'll get a code and a link to plex.tv/link; enter
  the code there like any other Plex app. No token to copy.
- **Silo** — log in with your Silo username and password.
- **Xtream Codes** — log in with the server URL + username + password your IPTV provider gave you.

Credentials are validated live against each service before being saved, and stored in
`server/data/settings.json` (gitignored) — not in `.env`, not committed anywhere.

## Verify the API directly

```bash
curl http://localhost:4000/api/settings/status
curl http://localhost:4000/api/live/channels
curl http://localhost:4000/api/ondemand
```

## Production-ish single process

```bash
npm run build
npm start
```

Builds `web/dist` and serves it from the same Fastify process as the API.

## Notes

- Stream URLs (`/api/stream/:source/:id`) redirect (302) to the real, token-bearing
  upstream URL — provider tokens never reach the browser directly in JSON responses.
- Library/channel listings are cached in-memory for `CACHE_TTL_SECONDS` (default 300s);
  the cache is invalidated automatically whenever you connect/disconnect a source in Settings.
- If a source isn't configured yet, `/api/ondemand` and `/api/live/*` degrade gracefully
  (409 for Live TV, partial results for On Demand) rather than erroring the whole app.
- **Known limitation:** Silo login works against its real API (`/api/v1/auth/login`,
  JWT-based — it is not actually Jellyfin/Emby-compatible despite running similar
  infrastructure). Its catalog browsing (`/api/v1/catalog`, 1M+ items, pagination
  unconfirmed) and per-item stream-resolution endpoint haven't been mapped yet, so Silo
  titles don't appear in the merged On Demand library. This is a deliberately deferred
  follow-up — see `server/src/clients/silo.ts`.
- No merged watch-progress sync, no native apps — deferred.
