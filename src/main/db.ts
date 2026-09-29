// Opens the small database file where Beemodoro saves your sessions and settings.
import Database from 'better-sqlite3'
import { app } from 'electron'
import { join } from 'path'
import { createSchema } from './schema'

// We only ever open the database once and reuse it after that.
let db: Database.Database | null = null

// Opens the database (creating it the first time the app runs) and makes sure
// its tables exist. Calling it again just hands back the one already open.
export function getDb(): Database.Database {
  if (db) return db

  // The file lives in the app's own private folder on your computer
  // (on a Mac: ~/Library/Application Support/beemodoro).
  const dbPath = join(app.getPath('userData'), 'beemodoro.db')
  db = new Database(dbPath)
  // A common setting that makes saving faster and less likely to corrupt the file.
  db.pragma('journal_mode = WAL')
  createSchema(db)

  return db
}
