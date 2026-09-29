// Automatic checks for settingsRepo.ts (saving and loading your settings).
// Run them with "npm test". Each it('...') line says in plain words what it checks.
import { describe, it, expect, beforeEach } from 'vitest'
import Database from 'better-sqlite3'
import { createSchema } from '../schema'
import {
  getSettings,
  setSnackDuration,
  setBreakMinutes,
  getVaultPath,
  setVaultPath,
  getVaultStatus
} from '../settingsRepo'

// Makes a throwaway database that only lives in memory, so tests never touch
// your real data.
function makeDb(): Database.Database {
  const db = new Database(':memory:')
  createSchema(db)
  return db
}

describe('settingsRepo', () => {
  let db: Database.Database

  // Every test starts with a fresh, empty database.
  beforeEach(() => {
    db = makeDb()
  })

  it('returns default snack durations and break length when nothing is saved', () => {
    const settings = getSettings(db)
    expect(settings.snackDurations).toEqual({
      pollen: 15,
      'honey-drop': 25,
      flower: 45,
      'honey-jar': 90
    })
    expect(settings.breakMinutes).toBe(5)
  })

  it('changing a snack duration is reflected in the next read', () => {
    setSnackDuration(db, 'pollen', 20)
    expect(getSettings(db).snackDurations.pollen).toBe(20)
    // Other durations stay at their defaults.
    expect(getSettings(db).snackDurations['honey-drop']).toBe(25)
  })

  it('changing the break duration is reflected in the next read', () => {
    setBreakMinutes(db, 10)
    expect(getSettings(db).breakMinutes).toBe(10)
  })

  it('vault path is null until chosen', () => {
    expect(getVaultPath(db)).toBeNull()
    expect(getVaultStatus(db)).toEqual({ path: null, exists: false })
  })

  it('saving a vault path persists it', () => {
    setVaultPath(db, '/tmp/some-vault')
    expect(getVaultPath(db)).toBe('/tmp/some-vault')
  })
})
