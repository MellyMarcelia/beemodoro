// Describes the tables inside the database. Kept in its own file so the tests
// can build a throwaway database without starting the whole app.
import type Database from 'better-sqlite3'

// Two tables: "sessions" (one row per focus session) and "settings" (a simple
// list of name + value pairs). Tables that already exist are left untouched,
// so this is safe to run every time the app opens.
export function createSchema(db: Database.Database): void {
  // What each column in "sessions" holds:
  //   id              - a number that's different for every session, handed out automatically
  //   snack           - which snack it was (like 'pollen')
  //   planned_seconds - how long it was meant to last
  //   elapsed_seconds - how long you actually focused (starts at 0)
  //   description     - what you said you'd work on
  //   status          - running, paused, completed or cancelled (nothing else is allowed)
  //   started_at      - when it started (filled in automatically)
  //   ended_at        - when it ended (empty until then)
  // In "settings", "key" is the setting's name and "value" is what it's set to.
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
