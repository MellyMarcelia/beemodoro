// The tools this file borrows: Electron (which turns a web page into a desktop
// app), the app icon, and our own database, settings, session and Obsidian code.
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

// The "backstage" of the app. It opens the window, builds the menu bar, and
// answers every request the screen sends (start a session, save a setting...)
// by reading or writing the database and the Obsidian notes.

// Writes one line to your Obsidian vault (if you've picked one).
function logSessionEvent(event: SessionEvent): void {
  appendSessionEvent(getVaultStatus(getDb()).path, event)
}

// Creates the app window: its size, the pink background, and what to show in it.
function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1000, // starting size, in pixels
    height: 600,
    minWidth: 880, // you can't shrink it smaller than this
    minHeight: 540,
    resizable: true,
    show: false, // stay hidden until the page is ready (see below)
    autoHideMenuBar: true, // on Windows/Linux, the menu bar only shows if you press Alt
    backgroundColor: '#F2CEC8', // the pink shown while the page is still loading
    ...(process.platform === 'linux' ? { icon } : {}), // Linux needs to be told which icon to use
    webPreferences: {
      // The go-between file (preload/index.ts) that lets the screen talk to this file.
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

  // While developing, show the live version that updates as code changes.
  // Otherwise, show the finished, packaged version.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// Builds the menu bar. The only custom item is "Settings..." (Cmd+, on Mac,
// Ctrl+, elsewhere). On Mac it sits under the app's name; elsewhere under File.
function buildMenu(): void {
  const isMac = process.platform === 'darwin' // "darwin" is the technical name for macOS
  const template: Electron.MenuItemConstructorOptions[] = [
    // Mac only: the menu named after the app, with Settings and Quit.
    // Clicking Settings tells the screen to open the Settings popup.
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
    // The File menu. On Windows/Linux it holds Settings and Quit; on Mac, just
    // "Close window".
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
    // The standard Edit, View and Window menus that Electron builds for us
    // (copy/paste, zoom, minimise...).
    { role: 'editMenu' as const },
    { role: 'viewMenu' as const },
    { role: 'windowMenu' as const }
  ]
  // Turn the list above into the real menu bar.
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

// Everything below runs once Electron has finished starting up.
app.whenReady().then(() => {
  // Gives the app its ID on Windows, so notifications and the taskbar group it properly.
  electronApp.setAppUserModelId('com.beemodoro.app')

  // Handy keyboard shortcuts for every window: F12 opens the developer tools
  // while developing, and the page-refresh shortcut is blocked in the real app.
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  buildMenu()

  // If the app crashed or was force-quit mid-session last time, save that
  // session as cancelled and note it in Obsidian, so it isn't lost.
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

  // Below is every request the screen can make. Think of each one as a phone
  // line: the screen calls e.g. 'vault:getStatus', and whatever we return is
  // sent back as the answer.

  // Settings: the vault folder and the snack and break lengths.

  // Which vault folder is saved, and whether it still exists.
  ipcMain.handle('vault:getStatus', () => getVaultStatus(getDb()))
  // Opens the "choose a folder" window. Returns null if you cancel.
  ipcMain.handle('vault:chooseFolder', async () => {
    // Attach the folder window to the app window if there is one, so it pops
    // out of it instead of floating somewhere on its own.
    const mainWindow = BrowserWindow.getFocusedWindow()
    const result = mainWindow
      ? await dialog.showOpenDialog(mainWindow, {
          properties: ['openDirectory', 'createDirectory']
        })
      : await dialog.showOpenDialog({ properties: ['openDirectory', 'createDirectory'] })
    if (result.canceled || result.filePaths.length === 0) return null
    // Save the folder you picked and send back the updated info.
    const chosenPath = result.filePaths[0]
    setVaultPath(getDb(), chosenPath)
    return getVaultStatus(getDb())
  })
  // Your snack and break lengths.
  ipcMain.handle('settings:get', () => getSettings(getDb()))
  // Save a new snack length or break length, then send back all settings.
  ipcMain.handle('settings:setSnackDuration', (_event, snack: SnackType, minutes: number) => {
    setSnackDuration(getDb(), snack, minutes)
    return getSettings(getDb())
  })
  ipcMain.handle('settings:setBreakMinutes', (_event, minutes: number) => {
    setBreakMinutes(getDb(), minutes)
    return getSettings(getDb())
  })

  // Sessions: start, save progress, pause, resume, cancel, complete, and list.

  // The session that's still going, if any (used when the app opens).
  ipcMain.handle('session:getActive', () => getActiveSession(getDb()))
  // New session: look up how long this snack lasts, save the session, and
  // write a "started" line to Obsidian.
  ipcMain.handle('session:start', (_event, input: NewSession) => {
    const settings = getSettings(getDb())
    const minutes = settings.snackDurations[input.snack]
    // If the description is somehow blank, fall back to e.g. "Pollen session".
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
  // The screen checks in every few seconds so progress is saved in case of a crash.
  ipcMain.handle('session:tick', (_event, id: number, elapsedSeconds: number) => {
    updateElapsedSeconds(getDb(), id, elapsedSeconds)
  })
  // Pause: save the time so far, then mark the session as paused.
  ipcMain.handle('session:pause', (_event, id: number, elapsedSeconds: number) => {
    updateElapsedSeconds(getDb(), id, elapsedSeconds)
    return pauseSession(getDb(), id)
  })
  // Resume: mark the session as running again.
  ipcMain.handle('session:resume', (_event, id: number) => resumeSession(getDb(), id))
  // Cancel and complete work the same way: close the session in the database,
  // then write it to Obsidian.
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
  // Every past session (for the Hive), and your all-time totals.
  ipcMain.handle('session:list', () => listSessions(getDb()))
  ipcMain.handle('session:stats', () => getStats(getDb()))

  // All set up, so open the window.
  createWindow()

  // On Mac, clicking the Dock icon when no window is open opens a new one.
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
