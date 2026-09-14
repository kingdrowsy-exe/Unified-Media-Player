import { NotConfiguredError, settingsStore } from "../settingsStore.js";

// Silo (branded "SiloSync"/"Ultimate Tunes" per-deployment) uses its own JWT-based
// REST API under /api/v1 - it is NOT Jellyfin/Emby-compatible despite running on top
// of similar infrastructure. Login is confirmed working; the catalog browsing and
// stream-resolution endpoints are still unknown and deferred (see README).

export interface SiloItem {
  Id: string;
  Name: string;
  ProductionYear?: number;
  Type: string;
  ImageTags?: { Primary?: string };
}

interface SiloAuthResult {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

let session: { accessToken: string; expiresAt: number } | null = null;

function requireSilo() {
  const silo = settingsStore.getSilo();
  if (!silo) {
    throw new NotConfiguredError("silo");
  }
  return silo;
}

export function resetSiloSession() {
  session = null;
}

async function authenticate(): Promise<{ accessToken: string; expiresAt: number }> {
  const silo = requireSilo();
  const res = await fetch(`${silo.baseUrl}/api/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: silo.username, password: silo.password }),
  });
  const contentType = res.headers.get("content-type") ?? "";
  if (!res.ok || !contentType.includes("application/json")) {
    throw new Error(`Silo authentication failed: ${res.status}`);
  }
  const data = (await res.json()) as SiloAuthResult;
  session = { accessToken: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
  return session;
}

async function getSession() {
  if (!session || session.expiresAt < Date.now()) {
    return authenticate();
  }
  return session;
}

export async function listSiloItems(): Promise<SiloItem[]> {
  requireSilo();
  await getSession();
  // Silo's catalog endpoint (/api/v1/catalog) is confirmed reachable and returns
  // real hosted movies/series, but its pagination and per-item stream-resolution
  // endpoints haven't been mapped yet - deferred until that's worked out, so Silo
  // titles don't appear in the merged On Demand library yet even though login works.
  return [];
}

export function siloPosterUrl(_itemId: string, _imageTags?: { Primary?: string }): string | undefined {
  return undefined;
}

export async function resolveSiloStreamUrl(_itemId: string): Promise<string> {
  throw new Error("Silo streaming isn't set up yet - this is coming in a follow-up.");
}
