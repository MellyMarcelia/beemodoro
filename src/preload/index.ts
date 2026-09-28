import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import type { Session, NewSession, Settings, VaultStatus, SnackType, Stats } from '../shared/types'

// Custom APIs for renderer
const api = {
  // Settings / Obsidian vault folder.
  getVaultStatus: (): Promise<VaultStatus> => ipcRenderer.invoke('vault:getStatus'),
  chooseVaultFolder: (): Promise<VaultStatus | null> => ipcRenderer.invoke('vault:chooseFolder'),
  getSettings: (): Promise<Settings> => ipcRenderer.invoke('settings:get'),
  setSnackDuration: (snack: SnackType, minutes: number): Promise<Settings> =>
    ipcRenderer.invoke('settings:setSnackDuration', snack, minutes),
  setBreakMinutes: (minutes: number): Promise<Settings> =>
    ipcRenderer.invoke('settings:setBreakMinutes', minutes),

  // Sessions.
  getActiveSession: (): Promise<Session | null> => ipcRenderer.invoke('session:getActive'),
  startSession: (input: NewSession): Promise<Session> => ipcRenderer.invoke('session:start', input),
  tickSession: (id: number, elapsedSeconds: number): Promise<void> =>
    ipcRenderer.invoke('session:tick', id, elapsedSeconds),
  pauseSession: (id: number, elapsedSeconds: number): Promise<Session> =>
    ipcRenderer.invoke('session:pause', id, elapsedSeconds),
  resumeSession: (id: number): Promise<Session> => ipcRenderer.invoke('session:resume', id),
  cancelSession: (id: number, elapsedSeconds: number): Promise<Session> =>
    ipcRenderer.invoke('session:cancel', id, elapsedSeconds),
  completeSession: (id: number, elapsedSeconds: number): Promise<Session> =>
    ipcRenderer.invoke('session:complete', id, elapsedSeconds),
  listSessions: (): Promise<Session[]> => ipcRenderer.invoke('session:list'),
  getStats: (): Promise<Stats> => ipcRenderer.invoke('session:stats')
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
