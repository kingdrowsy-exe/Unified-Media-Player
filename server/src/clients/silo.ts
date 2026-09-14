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

function requireSilo() {
  const silo = settingsStore.getSilo();
  if (!silo) {
    throw new NotConfiguredError("silo");
  }
  return silo;
}

export async function listSiloItems(): Promise<SiloItem[]> {
  requireSilo();
  // Silo's catalog endpoint (/api/v1/catalog) is confirmed reachable and returns
  // real hosted movies/series, but its pagination and per-item stream-resolution
  // endpoints haven't been mapped yet - deferred until that's worked out, so Silo
  // titles don't appear in the merged On Demand library yet even though login works.
  // No point authenticating here just to throw the session away unused - skip it
  // until there's an actual catalog call to make with it.
  return [];
}

export function siloPosterUrl(_itemId: string, _imageTags?: { Primary?: string }): string | undefined {
  return undefined;
}

export async function resolveSiloStreamUrl(_itemId: string): Promise<string> {
  throw new Error("Silo streaming isn't set up yet - this is coming in a follow-up.");
}
