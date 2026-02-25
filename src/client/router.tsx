import { useState, useEffect } from "react";
import { LocalDashboard } from "./views/LocalDashboard.js";
import { FleetOverview } from "./views/FleetOverview.js";
import { NodeDashboard } from "./views/NodeDashboard.js";

// ---------------------------------------------------------------------------
// Hash router
// ---------------------------------------------------------------------------

type Route =
  | { view: "local" }
  | { view: "fleet" }
  | { view: "node"; nodeId: string };

function parseHash(): Route {
  const hash = window.location.hash;
  if (hash.startsWith("#/node/")) {
    const nodeId = decodeURIComponent(hash.slice(7));
    if (nodeId) return { view: "node", nodeId };
  }
  if (hash === "#/fleet") return { view: "fleet" };
  return { view: "local" };
}

// ---------------------------------------------------------------------------
// Router component
// ---------------------------------------------------------------------------

export function Router() {
  const [mode, setMode] = useState<"local" | "hub" | null>(null);
  const [route, setRoute] = useState<Route>(parseHash);

  // Detect hub vs local mode from /api/health
  useEffect(() => {
    fetch("/api/health")
      .then((r) => r.json())
      .then((data: { mode?: string }) => {
        const m = data.mode === "hub" ? "hub" : "local";
        setMode(m);
        if (m === "hub" && parseHash().view === "local") {
          window.location.hash = "#/fleet";
          setRoute({ view: "fleet" });
        }
      })
      .catch(() => setMode("local"));
  }, []);

  // Listen for hash changes
  useEffect(() => {
    function onHashChange() {
      setRoute(parseHash());
    }
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  // Loading state
  if (mode === null) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <span className="text-zinc-600 text-sm">Loading…</span>
      </div>
    );
  }

  // Local mode — single dashboard, no routing needed
  if (mode === "local") {
    return <LocalDashboard />;
  }

  // Hub mode — hash-based routing
  if (route.view === "node") {
    return (
      <NodeDashboard
        nodeId={route.nodeId}
        onBack={() => {
          window.location.hash = "#/fleet";
          setRoute({ view: "fleet" });
        }}
      />
    );
  }

  return (
    <FleetOverview
      onNodeClick={(nodeId) => {
        window.location.hash = `#/node/${encodeURIComponent(nodeId)}`;
        setRoute({ view: "node", nodeId });
      }}
    />
  );
}
