import { Database } from "bun:sqlite";

// ---------------------------------------------------------------------------
// SQLite singleton
// ---------------------------------------------------------------------------

let db: Database | null = null;

const SQLITE_PATH = process.env.SQLITE_PATH ?? "./forge-monitor.sqlite";

export function getDb(): Database {
  if (db) return db;

  db = new Database(SQLITE_PATH, { create: true });

  // Pragmas
  db.exec("PRAGMA journal_mode = WAL");
  db.exec("PRAGMA busy_timeout = 5000");
  db.exec("PRAGMA synchronous = NORMAL");
  db.exec("PRAGMA foreign_keys = ON");

  // Schema
  db.exec(`
    CREATE TABLE IF NOT EXISTS jobs (
      id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      type            TEXT NOT NULL,
      params          TEXT NOT NULL DEFAULT '{}',
      status          TEXT NOT NULL DEFAULT 'pending'
                        CHECK(status IN ('pending','assigned','running','completed','failed','quarantined')),
      priority        INTEGER NOT NULL DEFAULT 0,
      worker_id       TEXT,
      result          TEXT,
      result_hash     TEXT,
      created_at      INTEGER NOT NULL DEFAULT (unixepoch('now','subsec') * 1000),
      claimed_at      INTEGER,
      heartbeat_at    INTEGER,
      completed_at    INTEGER,
      attempts        INTEGER NOT NULL DEFAULT 0,
      max_attempts    INTEGER NOT NULL DEFAULT 3,
      max_runtime_ms  INTEGER NOT NULL DEFAULT 300000,
      fail_reason     TEXT,
      fail_history    TEXT NOT NULL DEFAULT '[]',
      solver_url      TEXT,
      solver_checksum TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_jobs_status_priority
      ON jobs(status, priority DESC, created_at ASC);

    CREATE INDEX IF NOT EXISTS idx_jobs_worker
      ON jobs(worker_id, status);

    CREATE TABLE IF NOT EXISTS workers (
      id              TEXT PRIMARY KEY,
      name            TEXT,
      cores           INTEGER NOT NULL DEFAULT 1,
      ram_gb          REAL NOT NULL DEFAULT 1.0,
      tags            TEXT NOT NULL DEFAULT '[]',
      registered_at   INTEGER NOT NULL DEFAULT (unixepoch('now','subsec') * 1000),
      last_heartbeat  INTEGER
    );
  `);

  console.log(`[db] SQLite initialized at ${SQLITE_PATH}`);
  return db;
}

export function initDb(): void {
  getDb();
}
