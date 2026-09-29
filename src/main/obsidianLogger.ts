// Writes a diary of your focus sessions into your Obsidian vault. Each time a
// session starts, finishes or is cancelled, one line is added to that day's
// note, e.g. <vault>/Beemodoro/Focus/2026/2026-09/2026-09-28.md
// Lines are only ever added to the end; nothing already written is changed.
// Tools for working with files and folders, plus the snack names.
import { appendFileSync, existsSync, mkdirSync } from 'fs'
import { dirname, join } from 'path'
import { SNACK_LABELS } from '../shared/types'
import type { SnackType } from '../shared/types'

// The three moments that get written down.
export type SessionEventType = 'session.started' | 'session.completed' | 'session.cancelled'

// Everything needed to write one line.
export interface SessionEvent {
  type: SessionEventType
  // 'running', 'completed' or 'cancelled'
  status: string
  snack: SnackType
  // How long the snack was set to (in minutes) when the session started
  snackMinutes: number
  description: string
  // Seconds actually spent focusing (paused time not included). Left out for
  // "started" lines, since no time has passed yet.
  durationSeconds?: number
}

// Adds a leading zero when needed, e.g. 7 -> "07".
function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

// Splits a moment in time into year, month, day, hour, minute and second, as a
// clock in the given time zone (like "Europe/Brussels") would show it.
function partsInTimeZone(
  date: Date,
  timeZone: string
): { year: string; month: string; day: string; hour: string; minute: string; second: string } {
  // Ask the computer's built-in date tool to read the clock in that time zone,
  // always with two digits (e.g. "07") and a 24-hour clock.
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  })
  // Turn its answer into a simple lookup, like { year: "2026", month: "09", ... }.
  const parts = Object.fromEntries(formatter.formatToParts(date).map((p) => [p.type, p.value]))
  // Some computers write midnight as "24". We want "00".
  const hour = parts.hour === '24' ? '00' : parts.hour
  return {
    year: parts.year,
    month: parts.month,
    day: parts.day,
    hour,
    minute: parts.minute,
    second: parts.second
  }
}

// How far ahead of or behind world standard time (UTC) the time zone is at
// that moment, written like "+02:00" or "-04:00".
function utcOffset(date: Date, timeZone: string): string {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    timeZoneName: 'shortOffset'
  })
  // The computer tells us something like "GMT+2" or "GMT-4:30"...
  const tzPart =
    formatter.formatToParts(date).find((p) => p.type === 'timeZoneName')?.value ?? 'GMT+0'
  // ...so we pick out the +/- sign, the hours, and the minutes (if any)...
  const match = tzPart.match(/GMT([+-])(\d+)(?::(\d+))?/)
  // (plain "GMT" with no number means zero difference)
  if (!match) return '+00:00'
  // ...and put them back together as "+02:00".
  const sign = match[1]
  const hours = pad2(Number(match[2]))
  const minutes = pad2(Number(match[3] ?? '0'))
  return `${sign}${hours}:${minutes}`
}

// The date and time shown at the start of every line, like
// "2026-09-28 19:30:12 (Europe/Brussels, UTC+02:00)".
export function formatTimestamp(date: Date, timeZone: string): string {
  const p = partsInTimeZone(date, timeZone)
  const offset = utcOffset(date, timeZone)
  return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}:${p.second} (${timeZone}, UTC${offset})`
}

// Turns seconds into minutes and seconds, e.g. 1500 -> "25m00s".
export function formatDuration(totalSeconds: number): string {
  // Round to a whole second, and never show a negative time.
  const clamped = Math.max(0, Math.round(totalSeconds))
  const minutes = Math.floor(clamped / 60)
  const seconds = clamped % 60
  return `${minutes}m${pad2(seconds)}s`
}

// Builds the full line of text written to the note for one event.
export function formatLogLine(event: SessionEvent, date: Date, timeZone: string): string {
  const timestamp = formatTimestamp(date, timeZone)
  const snackLabel = SNACK_LABELS[event.snack]
  // The ** and ` marks are Obsidian's way of writing bold and code-style text.
  let line =
    `- **${timestamp}** -- \`${event.type}\` -- Status: ${event.status} -- ` +
    `${snackLabel} (${event.snackMinutes} min) -- Description: "${event.description}"`
  // Only finished and cancelled sessions get a duration at the end.
  if (event.durationSeconds !== undefined) {
    line += ` -- Duration: ${formatDuration(event.durationSeconds)}`
  }
  return line
}

// Works out which note a line belongs in, based on the day it happened.
export function logFilePath(vaultPath: string, date: Date, timeZone: string): string {
  const p = partsInTimeZone(date, timeZone)
  return join(
    vaultPath,
    'Beemodoro',
    'Focus',
    p.year,
    `${p.year}-${p.month}`,
    `${p.year}-${p.month}-${p.day}.md`
  )
}

// Adds one line to today's note, creating the folders and note if needed.
// This can never crash the app:
// - no vault picked yet -> do nothing
// - the vault folder was moved or deleted -> do nothing (we don't recreate a
//   folder you may have removed on purpose)
// - anything else goes wrong -> print the error for developers and carry on
export function appendSessionEvent(
  vaultPath: string | null,
  event: SessionEvent,
  date: Date = new Date(),
  timeZone: string = Intl.DateTimeFormat().resolvedOptions().timeZone
): void {
  if (!vaultPath) return
  if (!existsSync(vaultPath)) return

  try {
    const filePath = logFilePath(vaultPath, date, timeZone)
    // Make the Beemodoro/Focus/year/month folders if they don't exist yet...
    mkdirSync(dirname(filePath), { recursive: true })
    // ...then add the line to the end of the day's note (creating it if needed).
    appendFileSync(filePath, formatLogLine(event, date, timeZone) + '\n', 'utf-8')
  } catch (error) {
    console.error('Failed to append Obsidian log line:', error)
  }
}
