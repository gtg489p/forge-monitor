# forge-monitor — Fleet Expansion Plan

> Written 2026-02-25. Current state: single-node dashboard working at `http://100.65.21.123:3000`.  
> This document covers the full roadmap to turn forge-monitor into a multi-machine fleet dashboard + distributed compute system.

---

## What We Have Today

A real-time system monitor running on `alacrity-forge-01`:
- CPU (overall + per-core with thermal strip + 8×8 expandable grid)
- Memory, Disk I/O, Network I/O, Load Average
- 5-minute rolling history, 1s updates via SSE
- Deployed as systemd service (`forge-monitor.service`)
- Stack: Bun + Hono + React + Tremor + Tailwind
- Accessible via Tailscale at `http://100.65.21.123:3000`

---

## The Vision

Multiple machines (Linux server, Windows laptops, idle PCs) all:
1. **Reporting their system metrics** to a central dashboard
2. **Picking up and solving optimization problems** from a shared job queue (prodplan)

You open one URL and see every machine. Click any machine to drill into its full dashboard. Any idle computer can join the fleet by running a single agent script.

---

## Architecture

```
[Remote Machines — any OS]
  agent.ts (Bun, ~150 lines)
  Collects: CPU%, memory%, disk, network, load
  → POST /api/ingest/:nodeId  every 5s
  Auth: Bearer token in header

[alacrity-forge-01 — central hub]
  Hono server (src/server.ts, extended)
  SQLite DB (forge-monitor.sqlite)
    - node_registry: id, name, first_seen, last_seen
    - node_metrics: node_id, timestamp, payload (48hr rolling)
  New routes:
    POST /api/ingest/:nodeId     ← receives agent pushes
    GET  /api/fleet              ← node list + latest metrics
    GET  /api/fleet/events       ← SSE stream for fleet view
    GET  /api/nodes/:id/snapshot ← per-node history from SQLite

[Browser]
  /            → Local dashboard (existing, unchanged)
  /#/fleet     → Fleet overview (all nodes as cards)
  /#/node/:id  → Full drill-down for any remote node
```

**Key principle:** Browser only talks to the central server. Remote machines only need outbound internet access. NAT is not a problem.

---

## The Three Phases

### Phase 1 — Fleet Monitoring (minimum viable)
**Goal:** Second machine pushes metrics → card appears in `/fleet` within 10 seconds.

**New files to create:**
```
src/db.ts                          SQLite schema + prune function
src/client/pages/FleetPage.tsx     Node card grid, SSE from /api/fleet/events
src/client/pages/LocalPage.tsx     Move existing App body here (small refactor)
src/client/components/NodeCard.tsx Name, status dot, CPU bar, mem bar, job count stub
agent/agent.ts                     The push agent (runs on remote machines)
agent/package.json                 { systeminformation dependency }
```

**Files to modify:**
```
src/server.ts    Add ingest + fleet routes + db import
src/types.ts     Add NodeRecord, IngestPayload types
src/client/App.tsx  Add hash router (#/fleet, #/node/:id) + nav links
```

**Nothing deleted. Every existing component and route survives intact.**

**Implementation order:**
1. `src/db.ts` — SQLite schema, prune function
2. `src/types.ts` — add NodeRecord, IngestPayload
3. `src/server.ts` — add ingest + fleet routes (test with curl before UI)
4. `agent/agent.ts` — push agent (test: run agent, see data arrive via curl)
5. `src/client/components/NodeCard.tsx`
6. `src/client/pages/FleetPage.tsx`
7. `src/client/App.tsx` — hash router + nav

Each step testable independently before the next.

### Phase 2 — History, Drill-Down, Polish
- `GET /api/nodes/:id/snapshot` returns last 300 points from SQLite
- `NodePage` (`/#/node/:id`) — full single-node dashboard for remote machines, reuses existing CpuCard/MemoryCard etc., data from central SQLite
- Status transitions: Online (<15s), Degraded (15–60s), Offline (>60s, grayed)
- Fleet card sparklines (tiny 30-point CPU line per card)
- Agent: write-to-local-file fallback (`~/.forge-monitor-buffer.ndjson`) instead of in-memory buffer only
- Token management: `POST /api/tokens` admin endpoint (env `ADMIN_SECRET`) — generate per-node tokens without redeploying

### Phase 3 — Job Dispatch (distributed compute)
- `job_queue` table in SQLite: `id, type, payload, status, claimed_by, claimed_at, result, created_at`
- `POST /api/jobs` — enqueue a problem
- `GET /api/jobs/claim` — worker polls, atomically claims one job (SQLite `BEGIN IMMEDIATE` + UPDATE)
- `POST /api/jobs/:id/result` — worker submits result
- `POST /api/workers/:id/heartbeat` — every 30s; reclaim sweep resets stalled jobs after 5min
- Job counts become real on fleet cards (Phase 1 stub replaced)
- `bun build --compile agent.ts` — produces single self-contained binary for easy distribution
- Workers can solve prodplan problems, not just report metrics

---

## Technology Decisions (final)

| Layer | Choice | Why |
|---|---|---|
| Agent runtime | Bun | Same stack, cross-platform, `systeminformation` works on Windows/Linux/Mac |
| Central framework | Hono (existing) | Just add routes, no new service |
| Metrics storage | SQLite via `bun:sqlite` | Native to Bun, zero extra service, 48hr rolling ≈ 50MB max |
| Agent auth | Bearer token per node | Simple, revokable, no OAuth complexity |
| Browser transport | SSE from central server | Same pattern as existing local dashboard |
| Dashboard routing | Hash router (no library) | ~10 lines of `window.location.hash` logic, no React Router needed |
| Job queue (Phase 3) | SQLite `BEGIN IMMEDIATE` | Equivalent to Postgres `SKIP LOCKED` at this scale |

---

## Onboarding a New Machine (<5 minutes)

### Windows
```powershell
# 1. Install Bun (30s)
winget install Oven-sh.Bun

# 2. Get the agent (20s)
git clone https://github.com/you/forge-monitor
cd forge-monitor/agent

# 3. Configure (20s) — create agent/.env
NODE_ID=laptop-win
CENTRAL_URL=http://100.65.21.123:3000
BEARER_TOKEN=<paste token from admin>

# 4. Run (10s)
bun run agent.ts
# Output: ✓ pushed  cpu=3.2%  mem=42%  (every 5s)

# 5. Verify — open browser
# http://100.65.21.123:3000/#/fleet
# → "laptop-win" card appears, green dot, live bars
```

### Make it persistent on Windows (optional)
```powershell
nssm install forge-agent "bun" "C:\path\to\agent.ts"
nssm set forge-agent AppEnvironmentExtra "NODE_ID=laptop-win" "CENTRAL_URL=..." "BEARER_TOKEN=..."
nssm start forge-agent
```

### Linux
```bash
# Same steps, just:
curl -fsSL https://bun.sh/install | bash
# Then same git clone + .env + bun run agent.ts
# For persistence: systemd unit (same pattern as forge-monitor.service)
```

---

## Fault Tolerance

| Scenario | Handling |
|---|---|
| Agent loses network | Buffers last 60 snapshots in memory, flushes on reconnect (Phase 2: writes to disk) |
| Node crashes mid-job | Heartbeat goes stale → reclaim sweep resets job to pending after 5min |
| Central server restarts | Agents reconnect automatically on next push interval |
| Bad job (crashes solver) | `attempt_count` cap — fails permanently after 3 tries, flagged for manual review |
| Two workers claim same job | Impossible — SQLite `BEGIN IMMEDIATE` is atomic |

---

## Current Git Log
```
d99ae5d fix: reorder CPU stats row - avg, hot, max, std dev
762c8b8 fix: single-column layout - each metric card gets full row on all screen sizes
782eeb6 feat: add per-core CPU detail - thermal strip, expandable 8x8 grid with sparklines
f9aa5e3 init
```

---

## Picking This Up Later

Start here:
1. Read this file
2. Check `git log --oneline` for current state
3. Start Phase 1, Step 1: write `src/db.ts`
4. Use Claude Code for implementation: `cd /home/nathan/forge-monitor && claude -p "..." --dangerously-skip-permissions --max-turns 30 --output-format json 2>&1 & PID=$!; wait $PID`
