// Reads and saves your settings: the Obsidian vault folder, how long each
// snack lasts, and how long a break lasts.
import type Database from 'better-sqlite3'
import { existsSync } from 'fs'
import type { Settings, SnackType, VaultStatus } from '../shared/types'
import { DEFAULT_SNACK_DURATIONS, DEFAULT_BREAK_MINUTES, SNACK_ORDER } from '../shared/types'

// The names each setting is saved under. Snack durations get one key per
// snack, like 'snackDuration:pollen'.
const VAULT_PATH_KEY = 'vaultPath'
const BREAK_MINUTES_KEY = 'breakMinutes'
const SNACK_DURATION_KEY_PREFIX = 'snackDuration:'

// One setting as the database hands it back: just its value, as text.
interface SettingRow {
  value: string | null
}

// Reads one setting by name (null if it was never saved).
function getSetting(db: Database.Database, key: string): string | null {
  const row = db.prepare<[string], SettingRow>('SELECT value FROM settings WHERE key = ?').get(key)
  return row?.value ?? null
}

// Saves one setting. If it already exists, it just overwrites the old value.
function setSetting(db: Database.Database, key: string, value: string): void {
  db.prepare(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
  ).run(key, value)
}

// The Obsidian vault folder you picked, or null if you haven't picked one yet.
export function getVaultPath(db: Database.Database): string | null {
  return getSetting(db, VAULT_PATH_KEY)
}

// Remembers the vault folder you just picked (replacing the old one).
export function setVaultPath(db: Database.Database, path: string): void {
  setSetting(db, VAULT_PATH_KEY, path)
}

// The saved vault folder, plus whether that folder can still be found on your
// computer. The screen uses this to decide which warning to show, if any.
export function getVaultStatus(db: Database.Database): VaultStatus {
  const path = getVaultPath(db)
  return { path, exists: path !== null && existsSync(path) }
}

// Your snack and break lengths in minutes. Anything you never changed (or that
// was saved as nonsense) falls back to the default.
export function getSettings(db: Database.Database): Settings {
  // Start with the defaults, then swap in each snack length you've saved.
  const snackDurations = { ...DEFAULT_SNACK_DURATIONS }
  for (const snack of SNACK_ORDER) {
    const raw = getSetting(db, SNACK_DURATION_KEY_PREFIX + snack)
    if (raw !== null) {
      const minutes = Number(raw)
      if (Number.isFinite(minutes) && minutes > 0) snackDurations[snack] = minutes
    }
  }
  // Same idea for the break: use the saved length if it's a real positive number.
  const rawBreak = getSetting(db, BREAK_MINUTES_KEY)
  const breakMinutes =
    rawBreak !== null && Number.isFinite(Number(rawBreak)) && Number(rawBreak) > 0
      ? Number(rawBreak)
      : DEFAULT_BREAK_MINUTES
  return { snackDurations, breakMinutes }
}

// Saves a new length for one snack. Only sessions started after this use it.
export function setSnackDuration(db: Database.Database, snack: SnackType, minutes: number): void {
  setSetting(db, SNACK_DURATION_KEY_PREFIX + snack, String(minutes))
}

// Saves a new break length. Only breaks started after this use it.
export function setBreakMinutes(db: Database.Database, minutes: number): void {
  setSetting(db, BREAK_MINUTES_KEY, String(minutes))
}
