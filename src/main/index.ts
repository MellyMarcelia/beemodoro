import { app, shell, BrowserWindow, ipcMain, dialog, Menu } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { getDb } from './db'
import {
  getVaultStatus,
  setVaultPath,
  getSettings,
  setSnackDuration,
  setBreakMinutes
} from './settingsRepo'
import { appendSessionEvent } from './obsidianLogger'
import type { SessionEvent } from './obsidianLogger'
import {
  createSession,
  getActiveSession,
  updateElapsedSeconds,
  pauseSession,
  resumeSession,
  endSession,
  listSessions,
  getStats,
  recoverAbandonedSession
} from './sessionsRepo'
import type { NewSession, SnackType } from '../shared/types'
import { SNACK_LABELS } from '../shared/types'

/** Appends one session event to the vault log, using the currently saved vault path. */
function logSessionEvent(event: SessionEvent): void {
  appendSessionEvent(getVaultStatus(getDb()).path, event)
}

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1000,
    height: 600,
    minWidth: 880,
    minHeight: 540,
    resizable: true,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#F2CEC8',
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

/** Cmd+, (or Ctrl+, elsewhere) opens Settings — the app's only custom menu item. */
function buildMenu(): void {
  const isMac = process.platform === 'darwin'
  const template: Electron.MenuItemConstructorOptions[] = [
    ...(isMac
      ? [
          {
            label: app.getName(),
            submenu: [
              {
                label: 'Settings...',
                accelerator: 'CmdOrCtrl+,',
                click: (): void => {
                  BrowserWindow.getFocusedWindow()?.webContents.send('open-settings')
                }
              },
              { type: 'separator' as const },
              { role: 'quit' as const }
            ]
          }
        ]
      : []),
    {
      label: 'File',
      submenu: [
        ...(isMac
          ? []
          : [
              {
                label: 'Settings...',
                accelerator: 'CmdOrCtrl+,',
                click: (): void => {
                  BrowserWindow.getFocusedWindow()?.webContents.send('open-settings')
                }
              }
            ]),
        { role: (isMac ? 'close' : 'quit') as 'close' | 'quit' }
      ]
    },
    { role: 'editMenu' as const },
    { role: 'viewMenu' as const },
    { role: 'windowMenu' as const }
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.beemodoro.app')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  buildMenu()

  // Crash recovery, run once at launch (Milestone 1 spec): a session left
  // running/paused when the app was last closed (force-quit, crash) is
  // auto-closed as cancelled using the last persisted elapsed time, and
  // logged — no session is ever silently dropped.
  const db = getDb()
  const recovered = recoverAbandonedSession(db)
  if (recovered) {
    const settings = getSettings(db)
    logSessionEvent({
      type: 'session.cancelled',
      status: 'cancelled',
      snack: recovered.snack,
      snackMinutes: settings.snackDurations[recovered.snack],
      description: recovered.description,
      durationSeconds: recovered.elapsedSeconds
    })
  }

  // Settings (vault folder + snack/break durations).
  ipcMain.handle('vault:getStatus', () => getVaultStatus(getDb()))
  ipcMain.handle('vault:chooseFolder', async () => {
    const mainWindow = BrowserWindow.getFocusedWindow()
    const result = mainWindow
      ? await dialog.showOpenDialog(mainWindow, {
          properties: ['openDirectory', 'createDirectory']
        })
      : await dialog.showOpenDialog({ properties: ['openDirectory', 'createDirectory'] })
    if (result.canceled || result.filePaths.length === 0) return null
    const chosenPath = result.filePaths[0]
    setVaultPath(getDb(), chosenPath)
    return getVaultStatus(getDb())
  })
  ipcMain.handle('settings:get', () => getSettings(getDb()))
  ipcMain.handle('settings:setSnackDuration', (_event, snack: SnackType, minutes: number) => {
    setSnackDuration(getDb(), snack, minutes)
    return getSettings(getDb())
  })
  ipcMain.handle('settings:setBreakMinutes', (_event, minutes: number) => {
    setBreakMinutes(getDb(), minutes)
    return getSettings(getDb())
  })

  // Sessions: start / pause / resume / cancel / complete / tick.
  ipcMain.handle('session:getActive', () => getActiveSession(getDb()))
  ipcMain.handle('session:start', (_event, input: NewSession) => {
    const settings = getSettings(getDb())
    const minutes = settings.snackDurations[input.snack]
    const description = input.description.trim() || `${SNACK_LABELS[input.snack]} session`
    const created = createSession(getDb(), { snack: input.snack, description }, minutes * 60)
    logSessionEvent({
      type: 'session.started',
      status: 'running',
      snack: created.snack,
      snackMinutes: minutes,
      description: created.description
    })
    return created
  })
  ipcMain.handle('session:tick', (_event, id: number, elapsedSeconds: number) => {
    updateElapsedSeconds(getDb(), id, elapsedSeconds)
  })
  ipcMain.handle('session:pause', (_event, id: number, elapsedSeconds: number) => {
    updateElapsedSeconds(getDb(), id, elapsedSeconds)
    return pauseSession(getDb(), id)
  })
  ipcMain.handle('session:resume', (_event, id: number) => resumeSession(getDb(), id))
  ipcMain.handle('session:cancel', (_event, id: number, elapsedSeconds: number) => {
    const settings = getSettings(getDb())
    const ended = endSession(getDb(), id, 'cancelled', elapsedSeconds)
    logSessionEvent({
      type: 'session.cancelled',
      status: 'cancelled',
      snack: ended.snack,
      snackMinutes: settings.snackDurations[ended.snack],
      description: ended.description,
      durationSeconds: ended.elapsedSeconds
    })
    return ended
  })
  ipcMain.handle('session:complete', (_event, id: number, elapsedSeconds: number) => {
    const settings = getSettings(getDb())
    const ended = endSession(getDb(), id, 'completed', elapsedSeconds)
    logSessionEvent({
      type: 'session.completed',
      status: 'completed',
      snack: ended.snack,
      snackMinutes: settings.snackDurations[ended.snack],
      description: ended.description,
      durationSeconds: ended.elapsedSeconds
    })
    return ended
  })
  ipcMain.handle('session:list', () => listSessions(getDb()))
  ipcMain.handle('session:stats', () => getStats(getDb()))

  createWindow()

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
