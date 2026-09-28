// The shapes of the data the whole app passes around (sessions, settings,
// snacks...), kept in one place so every part agrees on them.

// The four snacks. Each snack is a focus session of a different length.
export type SnackType = 'pollen' | 'honey-drop' | 'flower' | 'honey-jar'

// Pretty names to show on screen for each snack.
export const SNACK_LABELS: Record<SnackType, string> = {
  pollen: 'Pollen',
  'honey-drop': 'Honey drop',
  flower: 'Flower',
  'honey-jar': 'Honey jar'
}

// How many minutes each snack lasts until you change it in Settings.
export const DEFAULT_SNACK_DURATIONS: Record<SnackType, number> = {
  pollen: 15,
  'honey-drop': 25,
  flower: 45,
  'honey-jar': 90
}

// How many minutes a break lasts until you change it in Settings.
export const DEFAULT_BREAK_MINUTES = 5

// The order snacks show up in lists (smallest to biggest).
export const SNACK_ORDER: SnackType[] = ['pollen', 'honey-drop', 'flower', 'honey-jar']

// Where a session is at: still going, paused, finished, or cancelled.
export type SessionStatus = 'running' | 'paused' | 'completed' | 'cancelled'

// One focus session.
export interface Session {
  id: number
  snack: SnackType
  // How long the session is meant to last, in seconds (set when it starts)
  plannedSeconds: number
  // How many seconds you've actually focused so far (paused time not included)
  elapsedSeconds: number
  description: string
  status: SessionStatus
  startedAt: string
  endedAt: string | null
}

// What the screen sends when you start a new session.
export interface NewSession {
  snack: SnackType
  description: string
}

// Your settings: how many minutes each snack and each break lasts.
export interface Settings {
  snackDurations: Record<SnackType, number>
  breakMinutes: number
}

// Your all-time totals, counting finished sessions only.
export interface Stats {
  totalSessions: number
  totalFocusMinutes: number
}

// The Obsidian vault folder you picked, and whether it can still be found.
// "path" is empty (null) until you pick a folder in Settings.
export interface VaultStatus {
  path: string | null
  exists: boolean
}

// The bee's mood, which changes with what's happening on screen.
export type BeeMood = 'idle' | 'focus' | 'paused' | 'break' | 'completed' | 'cancelled'
