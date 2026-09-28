import { describe, it, expect, beforeEach } from 'vitest'
import Database from 'better-sqlite3'
import { createSchema } from '../schema'
import {
  createSession,
  getActiveSession,
  updateElapsedSeconds,
  pauseSession,
  resumeSession,
  endSession,
  getStats,
  recoverAbandonedSession,
  listSessions
} from '../sessionsRepo'

function makeDb(): Database.Database {
  const db = new Database(':memory:')
  createSchema(db)
  return db
}

describe('sessionsRepo', () => {
  let db: Database.Database

  beforeEach(() => {
    db = makeDb()
  })

  it('creates a session with the correct planned duration and running status', () => {
    const session = createSession(db, { snack: 'honey-drop', description: 'write tests' }, 25 * 60)
    expect(session.plannedSeconds).toBe(1500)
    expect(session.elapsedSeconds).toBe(0)
    expect(session.status).toBe('running')
  })

  it('getActiveSession finds the one running/paused session', () => {
    expect(getActiveSession(db)).toBeNull()
    const session = createSession(db, { snack: 'pollen', description: 'x' }, 900)
    expect(getActiveSession(db)?.id).toBe(session.id)
  })

  it('pausing freezes elapsed seconds; resuming keeps them (excludes paused wall-clock time)', () => {
    const session = createSession(db, { snack: 'pollen', description: 'x' }, 900)
    updateElapsedSeconds(db, session.id, 120)
    const paused = pauseSession(db, session.id)
    expect(paused.status).toBe('paused')
    expect(paused.elapsedSeconds).toBe(120)

    // Simulate time passing while paused — elapsed must not change.
    const stillPaused = getActiveSession(db)
    expect(stillPaused?.elapsedSeconds).toBe(120)

    const resumed = resumeSession(db, session.id)
    expect(resumed.status).toBe('running')
    expect(resumed.elapsedSeconds).toBe(120)
  })

  it('completing a session records the actual non-paused duration', () => {
    const session = createSession(db, { snack: 'flower', description: 'x' }, 2700)
    updateElapsedSeconds(db, session.id, 2700)
    const completed = endSession(db, session.id, 'completed', 2700)
    expect(completed.status).toBe('completed')
    expect(completed.elapsedSeconds).toBe(2700)
    expect(completed.endedAt).not.toBeNull()
  })

  it('cancelling a session records elapsed time up to the cancel point, excluding paused time', () => {
    const session = createSession(db, { snack: 'honey-jar', description: 'x' }, 5400)
    updateElapsedSeconds(db, session.id, 300)
    const cancelled = endSession(db, session.id, 'cancelled', 300)
    expect(cancelled.status).toBe('cancelled')
    expect(cancelled.elapsedSeconds).toBe(300)
  })

  it('lifetime stats only count completed sessions, never cancelled ones', () => {
    const a = createSession(db, { snack: 'pollen', description: 'a' }, 900)
    endSession(db, a.id, 'completed', 900)
    const b = createSession(db, { snack: 'honey-drop', description: 'b' }, 1500)
    endSession(db, b.id, 'cancelled', 200)
    const c = createSession(db, { snack: 'flower', description: 'c' }, 2700)
    endSession(db, c.id, 'completed', 2700)

    const stats = getStats(db)
    expect(stats.totalSessions).toBe(2)
    expect(stats.totalFocusMinutes).toBe(60) // (900 + 2700) / 60
  })

  it('recoverAbandonedSession auto-cancels a running session using its last persisted elapsed time', () => {
    const session = createSession(db, { snack: 'honey-drop', description: 'crash me' }, 1500)
    updateElapsedSeconds(db, session.id, 730)
    // Simulate a crash: no endSession call happens, app just restarts.
    const recovered = recoverAbandonedSession(db)
    expect(recovered?.id).toBe(session.id)
    expect(recovered?.status).toBe('cancelled')
    expect(recovered?.elapsedSeconds).toBe(730)
    expect(getActiveSession(db)).toBeNull()
  })

  it('recoverAbandonedSession also recovers a paused session', () => {
    const session = createSession(db, { snack: 'pollen', description: 'x' }, 900)
    updateElapsedSeconds(db, session.id, 60)
    pauseSession(db, session.id)
    const recovered = recoverAbandonedSession(db)
    expect(recovered?.status).toBe('cancelled')
    expect(recovered?.elapsedSeconds).toBe(60)
  })

  it('recoverAbandonedSession does nothing when there is no in-progress session', () => {
    expect(recoverAbandonedSession(db)).toBeNull()
  })

  it('listSessions returns sessions in chronological (insertion) order', () => {
    const a = createSession(db, { snack: 'pollen', description: 'a' }, 900)
    const b = createSession(db, { snack: 'flower', description: 'b' }, 2700)
    const all = listSessions(db)
    expect(all.map((s) => s.id)).toEqual([a.id, b.id])
  })
})
