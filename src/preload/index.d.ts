import { ElectronAPI } from '@electron-toolkit/preload'
import type { Session, NewSession, Settings, VaultStatus, SnackType, Stats } from '../shared/types'

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

declare global {
  interface Window {
    electron: ElectronAPI
    api: BeemodoroApi
  }
}
