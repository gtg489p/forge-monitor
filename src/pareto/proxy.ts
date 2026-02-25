import type { Hono } from "hono";

const PRODPLAN_BASE = process.env.PRODPLAN_URL ?? "http://localhost:8000";

export function mountParetoRoutes(app: Hono): void {
  app.get("/api/pareto/front", async (c) => {
    try {
      const url = new URL(c.req.url);
      const res = await fetch(`${PRODPLAN_BASE}/pareto-front/${url.search}`);
      if (!res.ok) return c.json({ error: "upstream error" }, 502);
      return c.json(await res.json());
    } catch {
      return c.json({ error: "prodplan API unavailable" }, 502);
    }
  });

  app.get("/api/pareto/quality", async (c) => {
    try {
      const res = await fetch(`${PRODPLAN_BASE}/front-quality/`);
      if (!res.ok) return c.json({ error: "upstream error" }, 502);
      return c.json(await res.json());
    } catch {
      return c.json({ error: "prodplan API unavailable" }, 502);
    }
  });

  app.get("/api/pareto/timeline", async (c) => {
    try {
      const url = new URL(c.req.url);
      const res = await fetch(
        `${PRODPLAN_BASE}/pareto-front-timeline/${url.search}`,
      );
      if (!res.ok) return c.json({ error: "upstream error" }, 502);
      return c.json(await res.json());
    } catch {
      return c.json({ error: "prodplan API unavailable" }, 502);
    }
  });
}
