// Database setup for Beemodoro's main process. better-sqlite3 is
// synchronous, keeping the data layer simple (same pattern as Todobee).
import Database from 'better-sqlite3'
import { app } from 'electron'
import { join } from 'path'
import { createSchema } from './schema'

let db: Database.Database | null = null

/**
 * Opens (or creates) the app's SQLite file in Electron's userData folder and
 * ensures the schema exists. Safe to call more than once.
 */
export function getDb(): Database.Database {
  if (db) return db

  const dbPath = join(app.getPath('userData'), 'beemodoro.db')
  db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  createSchema(db)

  return db
}
