// Append-only Obsidian logging. One bullet line per session event, appended
// to <vault>/Beemodoro/Focus/YYYY/YYYY-MM/YYYY-MM-DD.md, the file for the
// day the event actually happened (in the user's local timezone). Never
// rewrites or truncates existing content: every write here uses
// fs.appendFileSync, which only ever adds bytes to the end of the file.
// Adapted from Todobee's obsidianLogger.ts.
import { appendFileSync, existsSync, mkdirSync } from 'fs'
import { dirname, join } from 'path'
import { SNACK_LABELS } from '../shared/types'
import type { SnackType } from '../shared/types'

/** The three session events this logger knows how to write a line for. */
export type SessionEventType = 'session.started' | 'session.completed' | 'session.cancelled'

export interface SessionEvent {
  type: SessionEventType
  /** Status label written into the line: 'running', 'completed', or 'cancelled'. */
  status: string
  snack: SnackType
  /** Snack duration in minutes, as configured when the session started. */
  snackMinutes: number
  description: string
  /** Elapsed (non-paused) seconds; required on completed/cancelled, omitted on started. */
  durationSeconds?: number
}

/** Pads a number to 2 digits, e.g. 7 -> "07". Used for both dates and times. */
function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

/**
 * Reads a Date's calendar date/time fields as they appear in a given IANA
 * timezone (not the system timezone, not UTC).
 */
function partsInTimeZone(
  date: Date,
  timeZone: string
): { year: string; month: string; day: string; hour: string; minute: string; second: string } {
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
  const parts = Object.fromEntries(formatter.formatToParts(date).map((p) => [p.type, p.value]))
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

/** The UTC offset for a timezone at a given instant, as "+02:00" / "-04:00". */
function utcOffset(date: Date, timeZone: string): string {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    timeZoneName: 'shortOffset'
  })
  const tzPart =
    formatter.formatToParts(date).find((p) => p.type === 'timeZoneName')?.value ?? 'GMT+0'
  const match = tzPart.match(/GMT([+-])(\d+)(?::(\d+))?/)
  if (!match) return '+00:00'
  const sign = match[1]
  const hours = pad2(Number(match[2]))
  const minutes = pad2(Number(match[3] ?? '0'))
  return `${sign}${hours}:${minutes}`
}

/**
 * Formats an instant as "YYYY-MM-DD HH:MM:SS (Zone/Name, UTC+HH:MM)" in the
 * given timezone, the exact timestamp format required on every log line.
 */
export function formatTimestamp(date: Date, timeZone: string): string {
  const p = partsInTimeZone(date, timeZone)
  const offset = utcOffset(date, timeZone)
  return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}:${p.second} (${timeZone}, UTC${offset})`
}

/** Formats a duration in seconds as "XmYYs", e.g. 25*60 -> "25m00s". */
export function formatDuration(totalSeconds: number): string {
  const clamped = Math.max(0, Math.round(totalSeconds))
  const minutes = Math.floor(clamped / 60)
  const seconds = clamped % 60
  return `${minutes}m${pad2(seconds)}s`
}

/** Formats one bullet line for a session event, in the exact spec format. */
export function formatLogLine(event: SessionEvent, date: Date, timeZone: string): string {
  const timestamp = formatTimestamp(date, timeZone)
  const snackLabel = SNACK_LABELS[event.snack]
  let line =
    `- **${timestamp}** -- \`${event.type}\` -- Status: ${event.status} -- ` +
    `${snackLabel} (${event.snackMinutes} min) -- Description: "${event.description}"`
  if (event.durationSeconds !== undefined) {
    line += ` -- Duration: ${formatDuration(event.durationSeconds)}`
  }
  return line
}

/**
 * The log file path for the day an event happened, in the given timezone,
 * <vault>/Beemodoro/Focus/YYYY/YYYY-MM/YYYY-MM-DD.md.
 */
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

/**
 * Appends one bullet line for a session event to the vault's log file for
 * the day it happened, creating any missing folders/file along the way.
 *
 * Safe by design, never throws or crashes the app:
 * - vaultPath is null (no vault chosen yet) -> silently does nothing.
 * - the vault folder doesn't exist on disk (moved/deleted) -> silently does
 *   nothing, rather than recreating a folder the user removed on purpose.
 * - any other filesystem error -> logged to the console but swallowed.
 */
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
    mkdirSync(dirname(filePath), { recursive: true })
    appendFileSync(filePath, formatLogLine(event, date, timeZone) + '\n', 'utf-8')
  } catch (error) {
    console.error('Failed to append Obsidian log line:', error)
  }
}
