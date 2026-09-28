// Everything that saves or looks up focus sessions in the database.
import type Database from 'better-sqlite3'
import type { NewSession, Session, SessionStatus, SnackType } from '../shared/types'

// One session exactly as the database stores it (names written with_underscores).
interface SessionRow {
  id: number
  snack: string
  planned_seconds: number
  elapsed_seconds: number
  description: string
  status: string
  started_at: string
  ended_at: string | null
}

// Converts a database row into the shape the rest of the app uses.
function toSession(row: SessionRow): Session {
  return {
    id: row.id,
    snack: row.snack as SnackType,
    plannedSeconds: row.planned_seconds,
    elapsedSeconds: row.elapsed_seconds,
    description: row.description,
    status: row.status as SessionStatus,
    startedAt: row.started_at,
    endedAt: row.ended_at
  }
}

// Saves a brand-new session as "running". Its planned length is locked in now,
// so changing the snack's length later doesn't affect it.
export function createSession(
  db: Database.Database,
  input: NewSession,
  plannedSeconds: number
): Session {
  const result = db
    .prepare(
      'INSERT INTO sessions (snack, planned_seconds, elapsed_seconds, description, status) VALUES (?, ?, 0, ?, ?)'
    )
    .run(input.snack, plannedSeconds, input.description, 'running')
  return getSessionById(db, result.lastInsertRowid as number)!
}

// Grabs one session by its id (null if it doesn't exist).
export function getSessionById(db: Database.Database, id: number): Session | null {
  const row = db.prepare<[number], SessionRow>('SELECT * FROM sessions WHERE id = ?').get(id)
  return row ? toSession(row) : null
}

// The session going on right now (running or paused), or null. There's never
// more than one.
export function getActiveSession(db: Database.Database): Session | null {
  const row = db
    .prepare<[], SessionRow>(
      "SELECT * FROM sessions WHERE status IN ('running', 'paused') ORDER BY id DESC LIMIT 1"
    )
    .get()
  return row ? toSession(row) : null
}

// Saves how many seconds you've focused so far. Called every few seconds, so if
// the app crashes you only lose a moment of progress.
export function updateElapsedSeconds(
  db: Database.Database,
  id: number,
  elapsedSeconds: number
): void {
  db.prepare('UPDATE sessions SET elapsed_seconds = ? WHERE id = ?').run(elapsedSeconds, id)
}

// Marks a session as paused.
export function pauseSession(db: Database.Database, id: number): Session {
  db.prepare("UPDATE sessions SET status = 'paused' WHERE id = ?").run(id)
  return getSessionById(db, id)!
}

// Marks a paused session as running again.
export function resumeSession(db: Database.Database, id: number): Session {
  db.prepare("UPDATE sessions SET status = 'running' WHERE id = ?").run(id)
  return getSessionById(db, id)!
}

// Finishes a session as "completed" or "cancelled" and saves the final focus
// time (paused time never counts).
export function endSession(
  db: Database.Database,
  id: number,
  status: 'completed' | 'cancelled',
  elapsedSeconds: number
): Session {
  db.prepare(
    "UPDATE sessions SET status = ?, elapsed_seconds = ?, ended_at = datetime('now') WHERE id = ?"
  ).run(status, elapsedSeconds, id)
  return getSessionById(db, id)!
}

// Every session ever, oldest first. This is what fills the Hive.
export function listSessions(db: Database.Database): Session[] {
  const rows = db.prepare<[], SessionRow>('SELECT * FROM sessions ORDER BY id ASC').all()
  return rows.map(toSession)
}

// Your all-time totals: how many sessions you finished and how many minutes you
// focused. Cancelled sessions don't count.
export function getStats(db: Database.Database): {
  totalSessions: number
  totalFocusMinutes: number
} {
  const row = db
    .prepare<[], { total_sessions: number; total_seconds: number | null }>(
      "SELECT COUNT(*) AS total_sessions, SUM(elapsed_seconds) AS total_seconds FROM sessions WHERE status = 'completed'"
    )
    .get()!
  return {
    totalSessions: row.total_sessions,
    totalFocusMinutes: Math.round((row.total_seconds ?? 0) / 60)
  }
}

// Runs when the app opens. If a session was still going when the app was
// closed (it crashed or was force-quit), save it as cancelled with the time
// that was last saved, so nothing silently disappears. Returns that session,
// or null if there was nothing to clean up.
export function recoverAbandonedSession(db: Database.Database): Session | null {
  const active = getActiveSession(db)
  if (!active) return null
  return endSession(db, active.id, 'cancelled', active.elapsedSeconds)
}
