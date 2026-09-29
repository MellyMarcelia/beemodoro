// Electron's tools for passing messages between the screen and the backstage,
// plus the data shapes.
import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import type { Session, NewSession, Settings, VaultStatus, SnackType, Stats } from '../shared/types'

// The go-between. For safety, the screen isn't allowed to touch the database
// or your files directly. Instead it calls these functions (window.api.___),
// and each one passes the request along to the matching handler in main/index.ts.
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

// Hands these functions to the screen. The first way is the safe, normal one;
// the second is a fallback for when that safety feature is switched off.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // (The "@ts-ignore" lines tell the code checker not to complain here; these
  // are described properly in index.d.ts.)
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
