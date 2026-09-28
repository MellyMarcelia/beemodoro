// Repository functions for the key/value `settings` table: vault path plus
// tunable snack durations and break length. Plain functions over a plain
// better-sqlite3 Database so they're testable without Electron.
import type Database from 'better-sqlite3'
import { existsSync } from 'fs'
import type { Settings, SnackType, VaultStatus } from '../shared/types'
import { DEFAULT_SNACK_DURATIONS, DEFAULT_BREAK_MINUTES, SNACK_ORDER } from '../shared/types'

const VAULT_PATH_KEY = 'vaultPath'
const BREAK_MINUTES_KEY = 'breakMinutes'
const SNACK_DURATION_KEY_PREFIX = 'snackDuration:'

interface SettingRow {
  value: string | null
}

function getSetting(db: Database.Database, key: string): string | null {
  const row = db.prepare<[string], SettingRow>('SELECT value FROM settings WHERE key = ?').get(key)
  return row?.value ?? null
}

function setSetting(db: Database.Database, key: string, value: string): void {
  db.prepare(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
  ).run(key, value)
}

/** Returns the saved Obsidian vault folder path, or null if none has been chosen yet. */
export function getVaultPath(db: Database.Database): string | null {
  return getSetting(db, VAULT_PATH_KEY)
}

/** Saves the chosen Obsidian vault folder path, replacing any previous value. */
export function setVaultPath(db: Database.Database, path: string): void {
  setSetting(db, VAULT_PATH_KEY, path)
}

/**
 * The saved vault path plus whether that folder still exists on disk right
 * now; the renderer uses `exists` to decide which warning banner to show.
 */
export function getVaultStatus(db: Database.Database): VaultStatus {
  const path = getVaultPath(db)
  return { path, exists: path !== null && existsSync(path) }
}

/** Current settings: per-snack durations (minutes) and break length (minutes), falling back to defaults. */
export function getSettings(db: Database.Database): Settings {
  const snackDurations = { ...DEFAULT_SNACK_DURATIONS }
  for (const snack of SNACK_ORDER) {
    const raw = getSetting(db, SNACK_DURATION_KEY_PREFIX + snack)
    if (raw !== null) {
      const minutes = Number(raw)
      if (Number.isFinite(minutes) && minutes > 0) snackDurations[snack] = minutes
    }
  }
  const rawBreak = getSetting(db, BREAK_MINUTES_KEY)
  const breakMinutes =
    rawBreak !== null && Number.isFinite(Number(rawBreak)) && Number(rawBreak) > 0
      ? Number(rawBreak)
      : DEFAULT_BREAK_MINUTES
  return { snackDurations, breakMinutes }
}

/** Updates one snack type's duration (minutes). Respected by the next session started with that snack. */
export function setSnackDuration(db: Database.Database, snack: SnackType, minutes: number): void {
  setSetting(db, SNACK_DURATION_KEY_PREFIX + snack, String(minutes))
}

/** Updates the break duration (minutes). Respected by the next break started. */
export function setBreakMinutes(db: Database.Database, minutes: number): void {
  setSetting(db, BREAK_MINUTES_KEY, String(minutes))
}
