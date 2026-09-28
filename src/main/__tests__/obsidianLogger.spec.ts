import { describe, it, expect, afterEach } from 'vitest'
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import {
  formatTimestamp,
  formatDuration,
  formatLogLine,
  logFilePath,
  appendSessionEvent
} from '../obsidianLogger'

// Fixed instant: 2026-09-27T17:30:12.000Z is 19:30:12 in Europe/Brussels
// (UTC+02:00, daylight saving in effect in September).
const FIXED_INSTANT = new Date('2026-09-27T17:30:12.000Z')

describe('formatTimestamp', () => {
  it('formats date, time, and timezone name + UTC offset together', () => {
    expect(formatTimestamp(FIXED_INSTANT, 'Europe/Brussels')).toBe(
      '2026-09-27 19:30:12 (Europe/Brussels, UTC+02:00)'
    )
  })

  it('uses the local date/time for a different timezone, not UTC', () => {
    expect(formatTimestamp(FIXED_INSTANT, 'America/New_York')).toBe(
      '2026-09-27 13:30:12 (America/New_York, UTC-04:00)'
    )
  })
})

describe('formatDuration', () => {
  it('formats whole minutes as XmYYs', () => {
    expect(formatDuration(25 * 60)).toBe('25m00s')
  })

  it('formats a mix of minutes and seconds', () => {
    expect(formatDuration(90)).toBe('1m30s')
  })

  it('formats sub-minute durations', () => {
    expect(formatDuration(7)).toBe('0m07s')
  })

  it('rounds fractional seconds and clamps negatives to zero', () => {
    expect(formatDuration(59.6)).toBe('1m00s')
    expect(formatDuration(-5)).toBe('0m00s')
  })
})

describe('formatLogLine', () => {
  it('starts with a markdown bullet ("- ")', () => {
    const line = formatLogLine(
      {
        type: 'session.started',
        status: 'running',
        snack: 'honey-drop',
        snackMinutes: 25,
        description: 'Build honeycomb view'
      },
      FIXED_INSTANT,
      'Europe/Brussels'
    )
    expect(line.startsWith('- ')).toBe(true)
  })

  it('matches the exact bullet format from the spec for a completed session', () => {
    const line = formatLogLine(
      {
        type: 'session.completed',
        status: 'completed',
        snack: 'honey-drop',
        snackMinutes: 25,
        description: 'Build honeycomb view',
        durationSeconds: 1500
      },
      FIXED_INSTANT,
      'Europe/Brussels'
    )
    expect(line).toBe(
      '- **2026-09-27 19:30:12 (Europe/Brussels, UTC+02:00)** -- `session.completed` -- ' +
        'Status: completed -- Honey drop (25 min) -- Description: "Build honeycomb view" -- Duration: 25m00s'
    )
  })

  it('omits the Duration segment for session.started (no duration yet)', () => {
    const line = formatLogLine(
      {
        type: 'session.started',
        status: 'running',
        snack: 'pollen',
        snackMinutes: 15,
        description: 'Pollen session'
      },
      FIXED_INSTANT,
      'Europe/Brussels'
    )
    expect(line).not.toContain('Duration:')
  })

  it('includes Duration for a cancelled session', () => {
    const line = formatLogLine(
      {
        type: 'session.cancelled',
        status: 'cancelled',
        snack: 'flower',
        snackMinutes: 45,
        description: 'Flower session',
        durationSeconds: 125
      },
      FIXED_INSTANT,
      'Europe/Brussels'
    )
    expect(line).toContain('Duration: 2m05s')
  })
})

describe('logFilePath', () => {
  it('builds <vault>/Beemodoro/Focus/YYYY/YYYY-MM/YYYY-MM-DD.md from the local date', () => {
    const path = logFilePath('/vault', FIXED_INSTANT, 'Europe/Brussels')
    expect(path).toBe(join('/vault', 'Beemodoro', 'Focus', '2026', '2026-09', '2026-09-27.md'))
  })

  it('uses the timezone-local date at the day boundary, not the UTC date', () => {
    const nearMidnightUtc = new Date('2026-01-01T02:00:00.000Z')
    const path = logFilePath('/vault', nearMidnightUtc, 'America/New_York')
    expect(path).toBe(join('/vault', 'Beemodoro', 'Focus', '2025', '2025-12', '2025-12-31.md'))
  })
})

describe('appendSessionEvent', () => {
  let vaultDir: string

  afterEach(() => {
    if (vaultDir) rmSync(vaultDir, { recursive: true, force: true })
  })

  it('creates the folders and file when they do not exist yet', () => {
    vaultDir = mkdtempSync(join(tmpdir(), 'beemodoro-vault-'))
    appendSessionEvent(
      vaultDir,
      {
        type: 'session.started',
        status: 'running',
        snack: 'honey-drop',
        snackMinutes: 25,
        description: 'Build honeycomb view'
      },
      FIXED_INSTANT,
      'Europe/Brussels'
    )

    const filePath = logFilePath(vaultDir, FIXED_INSTANT, 'Europe/Brussels')
    expect(existsSync(filePath)).toBe(true)
    expect(readFileSync(filePath, 'utf-8')).toContain('session.started')
  })

  it('append never overwrites existing content, even across separate calls', () => {
    vaultDir = mkdtempSync(join(tmpdir(), 'beemodoro-vault-'))
    appendSessionEvent(
      vaultDir,
      {
        type: 'session.started',
        status: 'running',
        snack: 'pollen',
        snackMinutes: 15,
        description: 'first session'
      },
      FIXED_INSTANT,
      'Europe/Brussels'
    )
    appendSessionEvent(
      vaultDir,
      {
        type: 'session.completed',
        status: 'completed',
        snack: 'pollen',
        snackMinutes: 15,
        description: 'first session',
        durationSeconds: 900
      },
      new Date('2026-09-27T18:00:00.000Z'),
      'Europe/Brussels'
    )

    const filePath = logFilePath(vaultDir, FIXED_INSTANT, 'Europe/Brussels')
    const lines = readFileSync(filePath, 'utf-8').trim().split('\n')
    expect(lines).toHaveLength(2)
    expect(lines[0]).toContain('session.started')
    expect(lines[1]).toContain('session.completed')
  })

  it('does nothing and does not throw when no vault path is set', () => {
    expect(() =>
      appendSessionEvent(
        null,
        {
          type: 'session.started',
          status: 'running',
          snack: 'pollen',
          snackMinutes: 15,
          description: 'x'
        },
        FIXED_INSTANT
      )
    ).not.toThrow()
  })

  it('does nothing and does not throw when the vault folder does not exist', () => {
    expect(() =>
      appendSessionEvent(
        '/this/path/does/not/exist/at/all',
        {
          type: 'session.started',
          status: 'running',
          snack: 'pollen',
          snackMinutes: 15,
          description: 'x'
        },
        FIXED_INSTANT
      )
    ).not.toThrow()
  })
})
