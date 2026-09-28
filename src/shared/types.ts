// Shared data shapes used by main, preload, and renderer. Plain TypeScript
// interfaces (no classes/generics) — same beginner-friendly convention as
// Todobee.

/** The four fixed snack types and their default durations (minutes). */
export type SnackType = 'pollen' | 'honey-drop' | 'flower' | 'honey-jar'

export const SNACK_LABELS: Record<SnackType, string> = {
  pollen: 'Pollen',
  'honey-drop': 'Honey drop',
  flower: 'Flower',
  'honey-jar': 'Honey jar'
}

export const DEFAULT_SNACK_DURATIONS: Record<SnackType, number> = {
  pollen: 15,
  'honey-drop': 25,
  flower: 45,
  'honey-jar': 90
}

export const DEFAULT_BREAK_MINUTES = 5

export const SNACK_ORDER: SnackType[] = ['pollen', 'honey-drop', 'flower', 'honey-jar']

/** A session's lifecycle state. */
export type SessionStatus = 'running' | 'paused' | 'completed' | 'cancelled'

export interface Session {
  id: number
  snack: SnackType
  /** Planned duration in seconds (snack duration in minutes * 60, fixed at start). */
  plannedSeconds: number
  /** Elapsed focused seconds, excluding paused time. Persisted every tick for crash recovery. */
  elapsedSeconds: number
  description: string
  status: SessionStatus
  startedAt: string
  endedAt: string | null
}

/** Input shape for starting a new session. */
export interface NewSession {
  snack: SnackType
  description: string
}

/** Settings: per-snack durations (minutes) plus the break length (minutes). */
export interface Settings {
  snackDurations: Record<SnackType, number>
  breakMinutes: number
}

/** Lifetime stats computed live from completed sessions. */
export interface Stats {
  totalSessions: number
  totalFocusMinutes: number
}

/**
 * The saved Obsidian vault folder, plus whether it currently exists on disk.
 * `path` is null until the user has chosen a folder in Settings at least once.
 */
export interface VaultStatus {
  path: string | null
  exists: boolean
}

/** Bee mood, driven by the current session state. */
export type BeeMood = 'idle' | 'focus' | 'paused' | 'break' | 'completed' | 'cancelled'
