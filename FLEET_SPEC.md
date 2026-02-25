# Forge-Monitor Fleet Architecture — Implementation Spec
> Generated 2026-02-25 by master synthesis of 3 planning agents.

## Overview
Railway = pure hub (receives + displays). Each server runs agent.ts that pushes metrics.
Mode switch: `HUB_MODE=true` env var. Same codebase, different behavior.

## Auth
- Single shared `FORGE_INGEST_SECRET` env var (bearer token)
- NodeId from URL param, not token
- Auto-register node on first valid push

## Files to CREATE
```
src/local/collector.ts          — extracted collectMetrics + interval + routes
src/hub/nodes.ts                — NodeRecord, nodeRegistry Map, ring buffers, getStatus()
src/hub/relay.ts                — SSE client sets (fleet + per-node), broadcast, 2s throttle
src/hub/ingest.ts               — mountHubRoutes(): all ingest + fleet/node routes
agent/agent.ts                  — push loop, 180pt memory buffer, batch replay
agent/install.sh                — systemd installer for Linux
agent/install.ps1               — Windows service installer
agent/.env.example              — env var template
src/client/views/LocalDashboard.tsx   — current App.tsx body, verbatim
src/client/views/FleetOverview.tsx    — fleet grid, uses useFleet hook
src/client/views/NodeDashboard.tsx    — per-node detail, reuses all 5 cards unchanged
src/client/components/NodeCard.tsx        — status dot, name, cpu%, mem%, sparkline
src/client/components/NodeSparkline.tsx   — 60pt recharts sparkline, no axes
src/client/components/FleetSummaryBar.tsx — total/online/busiest
src/client/hooks/useFleet.ts          — SSE /api/fleet/events + initial fetch
src/client/hooks/useNodeMetrics.ts    — sibling of useMetrics, takes nodeId
src/client/router.tsx                 — ~15 line hash router + mode detection
```

## Files to MODIFY
```
src/server.ts     — mode switch, updated /api/health, delegate to mountLocalRoutes/mountHubRoutes
src/client/App.tsx — replace body with <Router />
package.json      — add start:hub, start:agent, dev:hub scripts
```

## Files that MUST NOT BE TOUCHED
```
src/types.ts
src/client/components/CpuCard.tsx
src/client/components/DiskCard.tsx
src/client/components/LoadCard.tsx
src/client/components/MemoryCard.tsx
src/client/components/NetworkCard.tsx
src/client/components/TimeSelector.tsx
src/client/lib/downsample.ts
src/client/lib/ringBuffer.ts
src/client/main.tsx
nixpacks.toml
vite.config.ts
tsconfig.json
```

## Routes

### Both modes
- `GET /api/health` → `{ok, mode:"hub"|"local", clients, nodes?}`

### Local mode (HUB_MODE absent/false)
- `GET /api/events` → SSE, 1s cadence, local metrics
- `GET /api/snapshot` → local history

### Hub mode (HUB_MODE=true)
- `POST /api/ingest/:nodeId` (Bearer auth) → 204
- `POST /api/ingest/:nodeId/batch` (Bearer auth) → 204
- `GET /api/fleet` → NodeWithStatus[]
- `GET /api/fleet/events` → SSE fan-out, 2s throttle per node
- `GET /api/nodes/:id/snapshot` → per-node history (360pt cap)
- `GET /api/nodes/:id/events` → per-node SSE

## Node Status
- online: lastSeen < 15s
- degraded: 15s-60s
- offline: >60s

## Agent .env
```
HUB_URL=https://your-hub.railway.app   # required
NODE_ID=my-server                       # required, url-safe
FORGE_INGEST_SECRET=changeme           # required, matches hub
NODE_NAME=My Server                    # optional, display name
PUSH_INTERVAL_MS=5000                  # optional, default 5000
```

## Railway Env Vars
```
HUB_MODE=true
FORGE_INGEST_SECRET=<openssl rand -hex 32>
```

## Implementation Order (22 tasks)
1. Extract src/local/collector.ts from server.ts — test: local still works
2. Mode-switch server.ts — test: HUB_MODE=true returns {mode:"hub"}
3. src/hub/nodes.ts — NodeRecord, registry, upsertNode, getStatus
4. src/hub/relay.ts — SSE client sets, broadcast functions
5. src/hub/ingest.ts POST routes — ingest + batch
6. src/hub/ingest.ts GET routes — fleet, node endpoints
7. agent/agent.ts — push loop, buffer, batch replay
8. agent/install.sh
9. agent/install.ps1 + .env.example
10. LocalDashboard.tsx — copy current App.tsx body
11. useFleet.ts hook
12. useNodeMetrics.ts hook
13. NodeSparkline.tsx
14. NodeCard.tsx
15. FleetSummaryBar.tsx
16. FleetOverview.tsx
17. NodeDashboard.tsx
18. router.tsx — hash router + /api/health mode detection
19. Update App.tsx — replace with <Router />
20. Update package.json scripts
21. End-to-end test
22. Build, git pull, commit, push
