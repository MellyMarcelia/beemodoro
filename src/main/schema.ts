// Describes the tables inside the database. Kept in its own file so the tests
// can build a throwaway database without starting the whole app.
import type Database from 'better-sqlite3'

// Two tables: "sessions" (one row per focus session) and "settings" (a simple
// list of name + value pairs). Tables that already exist are left untouched,
// so this is safe to run every time the app opens.
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
