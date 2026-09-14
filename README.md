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
- **TMDB** (optional) — paste an API Read Access Token (free at themoviedb.org/settings/api)
  to power the Popular Movies/Shows shelves on On Demand.

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
  upstream URL for Plex and Live TV — provider tokens never reach the browser directly in
  JSON responses. Silo is the exception: its stream endpoint requires an `Authorization`
  header (not a URL-embeddable token), which a redirect can't hand off to the browser, so
  Silo video is proxied through this server instead (`server/src/routes/stream.ts`).
- Library/channel listings are cached in-memory for `CACHE_TTL_SECONDS` (default 300s);
  the cache is invalidated automatically whenever you connect/disconnect a source in Settings.
- If a source isn't configured yet, `/api/ondemand` and `/api/live/*` degrade gracefully
  (409 for Live TV, partial results for On Demand) rather than erroring the whole app.
- **Known limitations:**
  - Silo: movies only for now — TV shows need per-episode lookups that aren't mapped yet.
    No confirmed catalog pagination, so (like Plex) only the first bounded page is shown.
    Silo's stream endpoint doesn't support Range requests, so seeking is limited to what
    the browser can do with an already-buffered progressive download.
  - On Demand search only covers each source's cached "popular" page, not the full
    library — see the note in `server/src/routes/ondemand.ts` for why.
- No merged watch-progress sync, no native apps — deferred.
