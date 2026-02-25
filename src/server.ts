import { Hono } from "hono";
import { serveStatic } from "hono/bun";
import { cors } from "hono/cors";

const HUB_MODE = process.env.HUB_MODE === "true";

// ---------------------------------------------------------------------------
// Hono app
// ---------------------------------------------------------------------------

const app = new Hono();

app.use("*", cors());

// ---------------------------------------------------------------------------
// Mode-specific routes
// ---------------------------------------------------------------------------

if (HUB_MODE) {
  const { mountHubRoutes } = await import("./hub/ingest.js");
  const { nodeRegistry } = await import("./hub/nodes.js");
  const { fleetClients } = await import("./hub/relay.js");
  const { initDb } = await import("./hub/db.js");
  const { mountJobRoutes, startReaper } = await import("./hub/jobs.js");

  initDb();
  mountHubRoutes(app);
  mountJobRoutes(app);
  startReaper();

  app.get("/api/health", (c) =>
    c.json({ ok: true, mode: "hub" as const, clients: fleetClients.size, nodes: nodeRegistry.size })
  );

  console.log("[forge-monitor] HUB_MODE=true — fleet hub active (job queue enabled)");
} else {
  const { mountLocalRoutes, getLocalClients } = await import("./local/collector.js");

  mountLocalRoutes(app);
  const localClients = getLocalClients();

  app.get("/api/health", (c) =>
    c.json({ ok: true, mode: "local" as const, clients: localClients.size })
  );

  console.log("[forge-monitor] HUB_MODE=false — local dashboard active");
}

// ---------------------------------------------------------------------------
// Pareto proxy (only if prodplan API is configured)
// ---------------------------------------------------------------------------

if (process.env.PRODPLAN_URL) {
  const { mountParetoRoutes } = await import("./pareto/proxy.js");
  mountParetoRoutes(app);
  console.log(`[forge-monitor] Pareto proxy → ${process.env.PRODPLAN_URL}`);
}

// ---------------------------------------------------------------------------
// Static files (built React SPA)
// ---------------------------------------------------------------------------

app.use("/*", serveStatic({ root: "./dist" }));

// SPA fallback — serve index.html for any unmatched route
app.notFound(async (c) => {
  try {
    const html = await Bun.file("./dist/index.html").text();
    return c.html(html);
  } catch {
    return c.text("Not found — run `bun run build` first.", 404);
  }
});

// ---------------------------------------------------------------------------
// Start server
// ---------------------------------------------------------------------------

const port = Number(process.env.PORT ?? 3000);
console.log(`[forge-monitor] listening on http://localhost:${port}`);

export default {
  port,
  hostname: "0.0.0.0",
  fetch: app.fetch,
};
