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

// This is the "backstage" of the app (Electron's main process). It opens the
// window, builds the menu, and answers every request the screen sends over
// (start a session, save settings, etc.) by talking to the database and
// writing to the Obsidian log.

/** Appends one session event to the vault log, using the currently saved vault path. */
function logSessionEvent(event: SessionEvent): void {
  appendSessionEvent(getVaultStatus(getDb()).path, event)
}

// Makes the app window: its size, the pink background, and which page to load.
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

  // Wait until the page is ready before showing the window, so there's no white flash.
  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  // Links that try to open a new window go to your normal browser instead.
  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // In dev mode, load from the live dev server (hot reload). Otherwise load the built files.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

/** Cmd+, (or Ctrl+, elsewhere) opens Settings: the app's only custom menu item. */
function buildMenu(): void {
  const isMac = process.platform === 'darwin'
  // On Mac, Settings goes in the app-name menu. Everywhere else it goes under File.
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

// Everything below runs once Electron has finished starting up.
app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.beemodoro.app')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  buildMenu()

  // Crash recovery, run once at launch (Milestone 1 spec): a session left
  // running/paused when the app was last closed (force-quit, crash) is
  // auto-closed as cancelled using the last persisted elapsed time, and
  // logged; no session is ever silently dropped.
  const db = getDb()
  const recovered = recoverAbandonedSession(db)
  if (recovered) {
    logSessionEvent({
      type: 'session.cancelled',
      status: 'cancelled',
      snack: recovered.snack,
      snackMinutes: Math.round(recovered.plannedSeconds / 60),
      description: recovered.description,
      durationSeconds: recovered.elapsedSeconds
    })
  }

  // Settings (vault folder + snack/break durations).
  // Each ipcMain.handle is like a little phone line: the screen calls
  // 'vault:getStatus' (etc.) and whatever we return gets sent back to it.
  ipcMain.handle('vault:getStatus', () => getVaultStatus(getDb()))
  // Pops up the "pick a folder" dialog. Returns null if you hit cancel.
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
  // New session: look up how long this snack is, save it, write a "started" line to Obsidian.
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
  // The screen checks in every few seconds so we save progress (crash insurance).
  ipcMain.handle('session:tick', (_event, id: number, elapsedSeconds: number) => {
    updateElapsedSeconds(getDb(), id, elapsedSeconds)
  })
  ipcMain.handle('session:pause', (_event, id: number, elapsedSeconds: number) => {
    updateElapsedSeconds(getDb(), id, elapsedSeconds)
    return pauseSession(getDb(), id)
  })
  ipcMain.handle('session:resume', (_event, id: number) => resumeSession(getDb(), id))
  // Cancel and complete work the same way: close the session in the DB, then log it.
  ipcMain.handle('session:cancel', (_event, id: number, elapsedSeconds: number) => {
    const ended = endSession(getDb(), id, 'cancelled', elapsedSeconds)
    logSessionEvent({
      type: 'session.cancelled',
      status: 'cancelled',
      snack: ended.snack,
      snackMinutes: Math.round(ended.plannedSeconds / 60),
      description: ended.description,
      durationSeconds: ended.elapsedSeconds
    })
    return ended
  })
  ipcMain.handle('session:complete', (_event, id: number, elapsedSeconds: number) => {
    const ended = endSession(getDb(), id, 'completed', elapsedSeconds)
    logSessionEvent({
      type: 'session.completed',
      status: 'completed',
      snack: ended.snack,
      snackMinutes: Math.round(ended.plannedSeconds / 60),
      description: ended.description,
      durationSeconds: ended.elapsedSeconds
    })
    return ended
  })
  ipcMain.handle('session:list', () => listSessions(getDb()))
  ipcMain.handle('session:stats', () => getStats(getDb()))

  createWindow()

  // Mac thing: clicking the dock icon with no windows open makes a new one.
  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Closing the last window quits the app, except on Mac where apps usually stay open.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
