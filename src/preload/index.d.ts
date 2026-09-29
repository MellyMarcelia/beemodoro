import { ElectronAPI } from '@electron-toolkit/preload'
import type { Session, NewSession, Settings, VaultStatus, SnackType, Stats } from '../shared/types'

// A description of the functions in preload/index.ts, so the code editor can
// suggest them and catch typos. Nothing in this file actually runs.
interface BeemodoroApi {
  getVaultStatus: () => Promise<VaultStatus>
  chooseVaultFolder: () => Promise<VaultStatus | null>
  getSettings: () => Promise<Settings>
  setSnackDuration: (snack: SnackType, minutes: number) => Promise<Settings>
  setBreakMinutes: (minutes: number) => Promise<Settings>

  getActiveSession: () => Promise<Session | null>
  startSession: (input: NewSession) => Promise<Session>
  tickSession: (id: number, elapsedSeconds: number) => Promise<void>
  pauseSession: (id: number, elapsedSeconds: number) => Promise<Session>
  resumeSession: (id: number) => Promise<Session>
  cancelSession: (id: number, elapsedSeconds: number) => Promise<Session>
  completeSession: (id: number, elapsedSeconds: number) => Promise<Session>
  listSessions: () => Promise<Session[]>
  getStats: () => Promise<Stats>
}

// Tells the code editor that the screen can use window.electron and window.api.
declare global {
  interface Window {
    electron: ElectronAPI
    api: BeemodoroApi
  }
}
