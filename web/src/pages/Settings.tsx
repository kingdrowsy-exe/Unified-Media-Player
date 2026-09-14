import { useEffect, useRef, useState } from "react";
import {
  SettingsStatus,
  disconnectPlex,
  disconnectSilo,
  disconnectXtream,
  fetchSettingsStatus,
  pollPlexLink,
  saveSilo,
  saveXtream,
  startPlexLink,
} from "../api.js";

type PlexLinkState =
  | { phase: "idle" }
  | { phase: "waiting"; code: string; pinId: number }
  | { phase: "error"; message: string };

function CredentialForm({
  title,
  description,
  onSubmit,
}: {
  title: string;
  description: string;
  onSubmit: (baseUrl: string, username: string, password: string) => Promise<void>;
}) {
  const [baseUrl, setBaseUrl] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await onSubmit(baseUrl, username, password);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="settings-form" onSubmit={handleSubmit}>
      <p className="settings-desc">{description}</p>
      <label>
        Server URL
        <input
          type="text"
          placeholder="https://your-server.example.com"
          value={baseUrl}
          onChange={(e) => setBaseUrl(e.target.value)}
          required
        />
      </label>
      <label>
        Username
        <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} required />
      </label>
      <label>
        Password
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </label>
      {error && <div className="settings-error">{error}</div>}
      <button type="submit" disabled={saving}>
        {saving ? "Connecting…" : `Log in to ${title}`}
      </button>
    </form>
  );
}

export default function Settings() {
  const [status, setStatus] = useState<SettingsStatus | null>(null);
  const [plexLink, setPlexLink] = useState<PlexLinkState>({ phase: "idle" });
  const pollRef = useRef<number | null>(null);

  function refreshStatus() {
    fetchSettingsStatus().then(setStatus);
  }

  useEffect(() => {
    refreshStatus();
    return () => {
      if (pollRef.current) window.clearInterval(pollRef.current);
    };
  }, []);

  async function beginPlexLink() {
    setPlexLink({ phase: "waiting", code: "", pinId: 0 });
    try {
      const { pinId, code } = await startPlexLink();
      setPlexLink({ phase: "waiting", code, pinId });

      pollRef.current = window.setInterval(async () => {
        try {
          const result = await pollPlexLink(pinId);
          if (result.linked) {
            if (pollRef.current) window.clearInterval(pollRef.current);
            setPlexLink({ phase: "idle" });
            refreshStatus();
          }
        } catch (err) {
          if (pollRef.current) window.clearInterval(pollRef.current);
          setPlexLink({ phase: "error", message: (err as Error).message });
        }
      }, 2000);
    } catch (err) {
      setPlexLink({ phase: "error", message: (err as Error).message });
    }
  }

  if (!status) {
    return <div className="page status">Loading settings…</div>;
  }

  return (
    <div className="page settings-page">
      <section className="settings-card">
        <div className="settings-card-header">
          <h2>Plex</h2>
          {status.plex && <span className="badge connected">Connected{status.plexServerName ? ` · ${status.plexServerName}` : ""}</span>}
        </div>
        {status.plex ? (
          <button
            className="secondary"
            onClick={() => disconnectPlex().then(refreshStatus)}
          >
            Disconnect
          </button>
        ) : plexLink.phase === "waiting" ? (
          <div className="plex-link">
            {plexLink.code ? (
              <>
                <p>
                  1. Open <a href="https://plex.tv/link" target="_blank" rel="noreferrer">plex.tv/link</a>
                </p>
                <p>
                  2. Enter this code: <strong className="link-code">{plexLink.code}</strong>
                </p>
                <p className="settings-desc">Waiting for you to authorize…</p>
              </>
            ) : (
              <p className="settings-desc">Starting link request…</p>
            )}
          </div>
        ) : (
          <>
            <p className="settings-desc">
              Connect your Plex account — no token to copy, just link it like any other Plex app.
            </p>
            <button onClick={beginPlexLink}>Link Plex Account</button>
          </>
        )}
        {plexLink.phase === "error" && <div className="settings-error">{plexLink.message}</div>}
      </section>

      <section className="settings-card">
        <div className="settings-card-header">
          <h2>Silo</h2>
          {status.silo && <span className="badge connected">Connected</span>}
        </div>
        {status.silo ? (
          <>
            <p className="settings-desc">
              Logged in. Browsing Silo's library in On Demand is still being built — coming in a
              follow-up.
            </p>
            <button className="secondary" onClick={() => disconnectSilo().then(refreshStatus)}>
              Disconnect
            </button>
          </>
        ) : (
          <CredentialForm
            title="Silo"
            description="Log in with your Silo (Jellyfin/Emby-compatible) account."
            onSubmit={async (baseUrl, username, password) => {
              await saveSilo(baseUrl, username, password);
              refreshStatus();
            }}
          />
        )}
      </section>

      <section className="settings-card">
        <div className="settings-card-header">
          <h2>Xtream Codes IPTV</h2>
          {status.xtream && <span className="badge connected">Connected</span>}
        </div>
        {status.xtream ? (
          <button className="secondary" onClick={() => disconnectXtream().then(refreshStatus)}>
            Disconnect
          </button>
        ) : (
          <CredentialForm
            title="Xtream Codes"
            description="Log in with the credentials your IPTV provider gave you."
            onSubmit={async (baseUrl, username, password) => {
              await saveXtream(baseUrl, username, password);
              refreshStatus();
            }}
          />
        )}
      </section>
    </div>
  );
}
