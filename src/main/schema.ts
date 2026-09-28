// Schema definition, split out from db.ts so it can be applied to a plain
// better-sqlite3 Database (including an in-memory one in tests) without
// touching Electron's app.getPath. Same pattern as Todobee.
import type Database from 'better-sqlite3'

export function createSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      snack TEXT NOT NULL,
      planned_seconds INTEGER NOT NULL,
      elapsed_seconds INTEGER NOT NULL DEFAULT 0,
      description TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'paused', 'completed', 'cancelled')),
      started_at TEXT NOT NULL DEFAULT (datetime('now')),
      ended_at TEXT
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );
  `)
}
