// Repository functions for the `sessions` table. Plain functions over a
// plain better-sqlite3 Database (same pattern as Todobee's tasksRepo/
// notesRepo) so timer/duration logic is testable without Electron.
import type Database from 'better-sqlite3'
import type { NewSession, Session, SessionStatus, SnackType } from '../shared/types'

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

/** Starts a new session in the `running` state. plannedSeconds is fixed at start (snack duration in minutes * 60). */
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

export function getSessionById(db: Database.Database, id: number): Session | null {
  const row = db.prepare<[number], SessionRow>('SELECT * FROM sessions WHERE id = ?').get(id)
  return row ? toSession(row) : null
}

/** The session currently in progress (running or paused), if any — at most one at a time. */
export function getActiveSession(db: Database.Database): Session | null {
  const row = db
    .prepare<[], SessionRow>(
      "SELECT * FROM sessions WHERE status IN ('running', 'paused') ORDER BY id DESC LIMIT 1"
    )
    .get()
  return row ? toSession(row) : null
}

/** Persists the latest elapsed seconds — called every tick so crash recovery never loses more than a few seconds. */
export function updateElapsedSeconds(
  db: Database.Database,
  id: number,
  elapsedSeconds: number
): void {
  db.prepare('UPDATE sessions SET elapsed_seconds = ? WHERE id = ?').run(elapsedSeconds, id)
}

/** Marks a session paused (elapsed time already persisted separately). */
export function pauseSession(db: Database.Database, id: number): Session {
  db.prepare("UPDATE sessions SET status = 'paused' WHERE id = ?").run(id)
  return getSessionById(db, id)!
}

/** Resumes a paused session. */
export function resumeSession(db: Database.Database, id: number): Session {
  db.prepare("UPDATE sessions SET status = 'running' WHERE id = ?").run(id)
  return getSessionById(db, id)!
}

/** Ends a session as completed or cancelled, with a final elapsed-seconds figure (excludes paused time). */
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

export function listSessions(db: Database.Database): Session[] {
  const rows = db.prepare<[], SessionRow>('SELECT * FROM sessions ORDER BY id ASC').all()
  return rows.map(toSession)
}

/** Lifetime stats: total completed sessions and total focus minutes — cancelled sessions never count. */
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

/**
 * Crash recovery: any session left `running`/`paused` at launch (the app
 * was force-quit mid-session) is auto-closed as `cancelled`, using the
 * elapsed seconds last persisted to SQLite — no silent data loss. Returns
 * the closed session, or null if nothing needed recovering.
 */
export function recoverAbandonedSession(db: Database.Database): Session | null {
  const active = getActiveSession(db)
  if (!active) return null
  return endSession(db, active.id, 'cancelled', active.elapsedSeconds)
}
