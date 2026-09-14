import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, "..", "data");
const settingsPath = path.join(dataDir, "settings.json");

export interface PlexSettings {
  baseUrl: string;
  token: string;
  serverName: string;
}

export interface SiloSettings {
  baseUrl: string;
  username: string;
  password: string;
}

export interface XtreamSettings {
  baseUrl: string;
  username: string;
  password: string;
}

interface Settings {
  plex?: PlexSettings;
  silo?: SiloSettings;
  xtream?: XtreamSettings;
}

let cache: Settings | null = null;

function load(): Settings {
  if (cache) return cache;
  if (fs.existsSync(settingsPath)) {
    cache = JSON.parse(fs.readFileSync(settingsPath, "utf-8")) as Settings;
  } else {
    cache = {};
  }
  return cache;
}

function persist() {
  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(settingsPath, JSON.stringify(cache, null, 2));
}

export const settingsStore = {
  getPlex(): PlexSettings | undefined {
    return load().plex;
  },
  setPlex(plex: PlexSettings) {
    load().plex = plex;
    persist();
  },
  clearPlex() {
    delete load().plex;
    persist();
  },
  getSilo(): SiloSettings | undefined {
    return load().silo;
  },
  setSilo(silo: SiloSettings) {
    load().silo = silo;
    persist();
  },
  clearSilo() {
    delete load().silo;
    persist();
  },
  getXtream(): XtreamSettings | undefined {
    return load().xtream;
  },
  setXtream(xtream: XtreamSettings) {
    load().xtream = xtream;
    persist();
  },
  clearXtream() {
    delete load().xtream;
    persist();
  },
  status() {
    const s = load();
    return {
      plex: Boolean(s.plex),
      silo: Boolean(s.silo),
      xtream: Boolean(s.xtream),
      plexServerName: s.plex?.serverName,
    };
  },
};

export class NotConfiguredError extends Error {
  constructor(public service: "plex" | "silo" | "xtream") {
    super(`${service} is not configured yet`);
  }
}
