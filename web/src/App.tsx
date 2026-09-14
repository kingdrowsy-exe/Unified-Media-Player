import { useEffect, useState } from "react";
import { Navigate, NavLink, Route, Routes } from "react-router-dom";
import Live from "./pages/Live.js";
import OnDemand from "./pages/OnDemand.js";
import Settings from "./pages/Settings.js";
import { fetchSettingsStatus } from "./api.js";

export default function App() {
  const [defaultRoute, setDefaultRoute] = useState<string | null>(null);

  useEffect(() => {
    fetchSettingsStatus()
      .then((status) => {
        const anyConfigured = status.plex || status.silo || status.xtream;
        setDefaultRoute(anyConfigured ? "/ondemand" : "/settings");
      })
      .catch(() => setDefaultRoute("/ondemand"));
  }, []);

  return (
    <div className="app-shell">
      <nav className="nav">
        <div className="nav-inner">
          <NavLink to="/ondemand" className={({ isActive }) => (isActive ? "active" : "")}>
            On Demand
          </NavLink>
          <NavLink to="/live" className={({ isActive }) => (isActive ? "active" : "")}>
            Live TV
          </NavLink>
          <NavLink to="/settings" className={({ isActive }) => (isActive ? "active" : "")}>
            Settings
          </NavLink>
        </div>
      </nav>
      <div className="app-routes">
        <Routes>
          <Route
            path="/"
            element={defaultRoute ? <Navigate to={defaultRoute} replace /> : null}
          />
          <Route path="/live" element={<Live />} />
          <Route path="/ondemand" element={<OnDemand />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </div>
    </div>
  );
}
